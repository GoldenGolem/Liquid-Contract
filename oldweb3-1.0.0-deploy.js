var fs = require('fs');
var Web3 = require('web3');
var solc = require('solc');
var linker = require('solc/linker');
var HDWalletProvider = require('truffle-hdwallet-provider');

var providers = require('./providers.json');

if (!process.argv[2] || !process.argv[3]) {
    throw 'Missing network and gas price args...';
}

var gasPrice = process.argv[3] * 1e9;
if (gasPrice < 1e8) {
    console.log('WARNING: GAS PRICE DANGEROUSLY LOW. TRANSACTIONS MAY NEVER GO THROUGH');
} else if (gasPrice > 1e11) {
    console.log('WARNING: GAS PRICE DANGEROUSLY HIGH. TRANSACTIONS WILL BE EXPENSIVE');
}
console.log('Gas price: ' + process.argv[3] + ' Gwei');

if (process.argv[2] == 'ropsten') {
    console.log('Deploying to Ropsten...');
    var provider = new HDWalletProvider(providers.ropsten.mnemonic, 'https://ropsten.infura.io/' + providers.ropsten.infuraKey);
} else if (process.argv[2] == 'mainnet') {
    console.log('Deploying to main net...');
    console.log('WARNING: THIS WILL USE REAL ETHER');
    console.log('Press CTRL + C to cancel...');
    var provider = new HDWalletProvider(providers.mainnet.mnemonic, 'https://mainnet.infura.io/' + providers.mainnet.infuraKey);
} else if (process.argv[2] == 'development') {
    console.log('Deploying to development network...');
    var provider = new Web3.providers.HttpProvider('http://' + providers.development.ip + ':8545');
} else if (process.argv[2] == 'localhost') {
    console.log('Deploying to localhost...');
    var provider = new Web3.providers.HttpProvider('http://localhost:9545');
} else if (process.argv[2] == 'ganache') {
    console.log('Deploying to localhost...');
    var provider = new Web3.providers.HttpProvider('http://localhost:8545');
} else {
    throw 'Invalid network arg...';
}

var web3 = new Web3(provider);

var input = {};

function walk(dir) {
    for (file of fs.readdirSync(dir)) {
        if (fs.statSync(dir + '/' + file).isFile()) {
            input[dir + '/' + file] = fs.readFileSync(dir + '/' + file, 'utf8');
        } else {
            walk(dir + '/' + file);
        }
    }
}
walk('./contracts');

var output = solc.compile({ sources: input }, 1);

var fatal = false;
for (var error in output.errors) {
    var message = output.errors[error];
    var message2 = message.slice(message.indexOf(' ') + 1);
    if (message2.slice(0, message2.indexOf(' ')) == 'Warning:') {
        console.log(message);
    } else {
        fatal = true;
        console.error(message);
    }
}

if (fatal) {
    throw 'Fatal error on compile. Aborting...';
} else {
    if (!fs.existsSync('./solcbuild/abi')) {
        fs.mkdirSync('./solcbuild');
        fs.mkdirSync('./solcbuild/abi');
    }
    for (var contractName in output.contracts) {
        // console.log(contractName);
        var contractFileName = contractName.slice(contractName.lastIndexOf(':') + 1);
        fs.writeFileSync('./solcbuild/' + contractFileName + '.bin', output.contracts[contractName].bytecode);
        fs.writeFileSync('./solcbuild/' + contractFileName + '.abi', output.contracts[contractName].interface);
    }
}

for (contractNeededByDApp of ['LiquidREPointer', 'LiquidRE', 'LiquidFactory', 'LiquidProperty', 'IREOLogic', 'LRETLogic', 'ConverterLogic', 'TPEG', 'RENT']) {
    fs.copyFileSync('./solcbuild/' + contractNeededByDApp + '.abi', './solcbuild/abi/' + contractNeededByDApp + 'ABI.json');
}

var contractNameKeys = {};

for (key in input) {
    let key2 = key.slice(key.lastIndexOf('/') + 1);
    let key3 = key2.slice(0, key2.lastIndexOf('.'));
    // console.log(key3);
    if (['SafeMath', 'LiquidRE', 'LiquidREPointer', 'BancorFormula', 'LiquidFactory', 'ConverterLogic', 'IREOLogic', 'LRETLogic', 'TPEG', 'RENT'].indexOf(key3) != -1) {
        contractNameKeys[key3] = key + ':' + key3;
    }
}

// console.log(contractNameKeys);
var liquidREPointerAddress;

var deploySafeMath = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['SafeMath']].interface), null, { data: '0x' + output.contracts[contractNameKeys['SafeMath']].bytecode })).deploy();

var deployLiquidRE = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidRE']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LiquidRE']].bytecode })).deploy();

var deployBancorFormula = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['BancorFormula']].interface), null, { data: '0x' + output.contracts[contractNameKeys['BancorFormula']].bytecode })).deploy();

web3.eth.getAccounts().then((accounts) => {
    web3.eth.defaultAccount = accounts[0];

    var safeMathPromise = deploySafeMath.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
        return deploySafeMath.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    });

    var liquidREPromise = deployLiquidRE.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
        return deployLiquidRE.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    });

    var bancorFormulaPromise = deployBancorFormula.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
        return deployBancorFormula.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    });

    // waits until all have resolved or any rejected before proceeding
    Promise.all([safeMathPromise, liquidREPromise, bancorFormulaPromise]).then((values) => {
        console.log('SafeMath: ' + values[0].options.address);
        console.log('LiquidRE: ' + values[1].options.address);
        console.log('BancorFormula: ' + values[2].options.address);
        // console.log(values);
        var deployLiquidREPointer = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidREPointer']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LiquidREPointer']].bytecode })).deploy({ arguments: [values[1].options.address] });

        var liquidREPointerPromise = deployLiquidREPointer.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
            return deployLiquidREPointer.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
        }).then((contractInstance) => {
            console.log('LiquidREPointer: ' + contractInstance.options.address);
            // return contractInstance.options.address;
            liquidREPointerAddress = contractInstance.options.address;
            let linkObj = {};
            linkObj[contractNameKeys['SafeMath']] = values[0].options.address;

            var deployLiquidFactory = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidFactory']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['LiquidFactory']].bytecode, linkObj) })).deploy({ arguments: [contractInstance.options.address] });

            var deployConverterLogic = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['ConverterLogic']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['ConverterLogic']].bytecode, linkObj) })).deploy({ arguments: [contractInstance.options.address] });

            var deployIREOLogic = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['IREOLogic']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['IREOLogic']].bytecode, linkObj) })).deploy({ arguments: [contractInstance.options.address] });

            var deployTPEG = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['TPEG']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['TPEG']].bytecode, linkObj) })).deploy({ arguments: [contractInstance.options.address] });

            var deployLRETLogic = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LRETLogic']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LRETLogic']].bytecode })).deploy({ arguments: [contractInstance.options.address] });

            var deployRENT = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['RENT']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['RENT']].bytecode, linkObj) })).deploy({ arguments: [contractInstance.options.address] });

            var liquidFactoryPromise = deployLiquidFactory.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployLiquidFactory.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var converterLogicPromise = deployConverterLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployConverterLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var ireoLogicPromise = deployIREOLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployIREOLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var tpegPromise = deployTPEG.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployTPEG.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var lretLogicPromise = deployLRETLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployLRETLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var rentPromise = deployRENT.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployRENT.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            Promise.all([liquidFactoryPromise, converterLogicPromise, ireoLogicPromise, tpegPromise, lretLogicPromise, rentPromise]).then((values2) => {
                console.log('LiquidFactory: ' + values2[0].options.address);
                console.log('ConverterLogic: ' + values2[1].options.address);
                console.log('IREOLogic: ' + values2[2].options.address);
                console.log('TPEG: ' + values2[3].options.address);
                console.log('LRETLogic: ' + values2[4].options.address);
                console.log('RENT: ' + values2[5].options.address);
                var liquidRESetBancorFormula = values[1].methods.setBancorFormula(values[2].options.address);
                var liquidRESetBancorFormulaPromise = liquidRESetBancorFormula.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetBancorFormula.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetLiquidFactory = values[1].methods.setLiquidFactory(values2[0].options.address);
                var liquidRESetLiquidFactoryPromise = liquidRESetLiquidFactory.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetLiquidFactory.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetIREOLogic = values[1].methods.setIREOLogic(values2[2].options.address, 0);
                var liquidRESetIREOLogicPromise = liquidRESetIREOLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetIREOLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetLRETLogic = values[1].methods.setLRETLogic(values2[4].options.address, 0);
                var liquidRESetLRETLogicPromise = liquidRESetLRETLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetLRETLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetConverterLogic = values[1].methods.setConverterLogic(values2[1].options.address, 0);
                var liquidRESetConverterLogicPromise = liquidRESetConverterLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetConverterLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetStableToken = values[1].methods.setStableToken(values2[3].options.address);
                var liquidRESetStableTokenPromise = liquidRESetStableToken.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetStableToken.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetRENT = values[1].methods.setRENT(values2[5].options.address);
                var liquidRESetRENTPromise = liquidRESetRENT.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetRENT.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                Promise.all([liquidRESetBancorFormulaPromise, liquidRESetLiquidFactoryPromise, liquidRESetIREOLogicPromise, liquidRESetLRETLogicPromise, liquidRESetConverterLogicPromise, liquidRESetStableTokenPromise, liquidRESetRENTPromise]).then((values3) => {
                    if (process.argv[2] != 'localhost') {
                        let addressFilename = './LiquidREPointer.json';
                        if (process.argv[2] == 'ropsten') {
                            addressFilename = './LiquidREPointerRopsten.json';
                        } else if (process.argv[2] == 'development') {
                            addressFilename = './LiquidREPointerLocal.json';
                        }
                        fs.writeFileSync(addressFilename, '{"address":"' + liquidREPointerAddress + '"}');
                    }
                    console.log('Deploy completed...');
                }).catch(console.error);
            }).catch(console.error);
        }).catch(console.error);
    }).catch(console.error);
}).catch(console.error);
