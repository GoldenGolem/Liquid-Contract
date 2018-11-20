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
        // return deploySafeMath.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    });

    var liquidREPromise = deployLiquidRE.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
        // return deployLiquidRE.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    });

    var bancorFormulaPromise = deployBancorFormula.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
        // return deployBancorFormula.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    });

    // waits until all have resolved or any rejected before proceeding
    Promise.all([safeMathPromise, liquidREPromise, bancorFormulaPromise]).then((values) => {
        // console.log('SafeMath: ' + values[0].options.address);
        console.log('SafeMath: 0xbF1B82D92c222384C60AcEcAE4FeE2C066a77A50');
        // console.log('LiquidRE: ' + values[1].options.address);
        console.log('LiquidRE: 0x063C2D13221442bbE6F7f21743641e89BcFd5198');
        // console.log('BancorFormula: ' + values[2].options.address);
        console.log('BancorFormula: 0xbBeAD3567075612585bdfb796665d2ebdfCf3e1C');
        // console.log(values);
        // var deployLiquidREPointer = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidREPointer']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LiquidREPointer']].bytecode })).deploy({ arguments: [values[1].options.address] });
        var deployLiquidREPointer = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidREPointer']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LiquidREPointer']].bytecode })).deploy({ arguments: ['0x063C2D13221442bbE6F7f21743641e89BcFd5198'] });

        var liquidREPointerPromise = deployLiquidREPointer.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
            // return deployLiquidREPointer.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
        }).then((contractInstance) => {
            console.log('LiquidREPointer: 0x5a67eeB1a728428c02bfBB347Ef062deC33b8a13');
            // return contractInstance.options.address;
            // liquidREPointerAddress = contractInstance.options.address;
            liquidREPointerAddress = '0x5a67eeB1a728428c02bfBB347Ef062deC33b8a13';
            let linkObj = {};
            // linkObj[contractNameKeys['SafeMath']] = values[0].options.address;
            linkObj[contractNameKeys['SafeMath']] = '0xbF1B82D92c222384C60AcEcAE4FeE2C066a77A50';

            var deployLiquidFactory = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidFactory']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['LiquidFactory']].bytecode, linkObj) })).deploy({ arguments: [liquidREPointerAddress] });

            var deployConverterLogic = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['ConverterLogic']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['ConverterLogic']].bytecode, linkObj) })).deploy({ arguments: [liquidREPointerAddress] });

            var deployIREOLogic = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['IREOLogic']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['IREOLogic']].bytecode, linkObj) })).deploy({ arguments: [liquidREPointerAddress] });

            var deployTPEG = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['TPEG']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['TPEG']].bytecode, linkObj) })).deploy({ arguments: [liquidREPointerAddress] });

            var deployLRETLogic = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LRETLogic']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LRETLogic']].bytecode })).deploy({ arguments: [liquidREPointerAddress] });

            var deployRENT = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['RENT']].interface), null, { data: '0x' + linker.linkBytecode(output.contracts[contractNameKeys['RENT']].bytecode, linkObj) })).deploy({ arguments: [liquidREPointerAddress] });

            var liquidFactoryPromise = deployLiquidFactory.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                // return deployLiquidFactory.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var converterLogicPromise = deployConverterLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                // return deployConverterLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var ireoLogicPromise = deployIREOLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployIREOLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var tpegPromise = deployTPEG.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                // return deployTPEG.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var lretLogicPromise = deployLRETLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                return deployLRETLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            var rentPromise = deployRENT.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                // return deployRENT.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
            });

            Promise.all([liquidFactoryPromise, converterLogicPromise, ireoLogicPromise, tpegPromise, lretLogicPromise, rentPromise]).then((values2) => {
                console.log('LiquidFactory: 0x95D53b3858CA24E1dFc119364b7a58e7458f3d17');
                console.log('ConverterLogic: 0x2E681E2ACB8AFfb3AE1646D231437f627A69b6d6');
                console.log('IREOLogic: ' + values2[2].options.address);
                console.log('TPEG: 0x985f8d44332d463BE7d888E3676CFDC602B69a4C');
                console.log('LRETLogic: ' + values2[4].options.address);
                console.log('RENT: 0x0f8BeACa9af46adE4Eea86fE255a0d49A50cFEFC');
                // var liquidRESetBancorFormula = values[1].methods.setBancorFormula(values[2].options.address);
                var liquidREContract = new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidRE']].interface), '0x063C2D13221442bbE6F7f21743641e89BcFd5198');
                var liquidRESetBancorFormula = liquidREContract.methods.setBancorFormula('0xbBeAD3567075612585bdfb796665d2ebdfCf3e1C');
                var liquidRESetBancorFormulaPromise = liquidRESetBancorFormula.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetBancorFormula.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetLiquidFactory = liquidREContract.methods.setLiquidFactory('0x95D53b3858CA24E1dFc119364b7a58e7458f3d17');
                var liquidRESetLiquidFactoryPromise = liquidRESetLiquidFactory.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetLiquidFactory.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetIREOLogic = liquidREContract.methods.setIREOLogic(values2[2].options.address, 0);
                var liquidRESetIREOLogicPromise = liquidRESetIREOLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetIREOLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetLRETLogic = liquidREContract.methods.setLRETLogic(values2[4].options.address, 0);
                var liquidRESetLRETLogicPromise = liquidRESetLRETLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetLRETLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetConverterLogic = liquidREContract.methods.setConverterLogic('0x2E681E2ACB8AFfb3AE1646D231437f627A69b6d6', 0);
                var liquidRESetConverterLogicPromise = liquidRESetConverterLogic.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetConverterLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetStableToken = liquidREContract.methods.setStableToken('0x985f8d44332d463BE7d888E3676CFDC602B69a4C');
                var liquidRESetStableTokenPromise = liquidRESetStableToken.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
                    return liquidRESetStableToken.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
                });

                var liquidRESetRENT = liquidREContract.methods.setRENT('0x0f8BeACa9af46adE4Eea86fE255a0d49A50cFEFC');
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
