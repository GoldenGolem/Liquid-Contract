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

// var deploySafeMath = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['SafeMath']].interface), null, { data: '0x' + output.contracts[contractNameKeys['SafeMath']].bytecode })).deploy();

// var deployLiquidRE = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidRE']].interface), null, { data: '0x' + output.contracts[contractNameKeys['LiquidRE']].bytecode })).deploy();

// var deployBancorFormula = (new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['BancorFormula']].interface), null, { data: '0x' + output.contracts[contractNameKeys['BancorFormula']].bytecode })).deploy();

web3.eth.getAccounts().then((accounts) => {
    web3.eth.defaultAccount = accounts[0];

    var liquidREContract = new web3.eth.Contract(JSON.parse(output.contracts[contractNameKeys['LiquidRE']].interface), '0x063C2D13221442bbE6F7f21743641e89BcFd5198');
    var liquidRESetBancorFormula = liquidREContract.methods.setBancorFormula('0xbBeAD3567075612585bdfb796665d2ebdfCf3e1C');
    var liquidRESetLiquidFactory = liquidREContract.methods.setLiquidFactory('0x95D53b3858CA24E1dFc119364b7a58e7458f3d17');
    var liquidRESetIREOLogic = liquidREContract.methods.setIREOLogic('0xE64dDce07EEE017ee7caEb0E33f84d925AF250A8', 0);
    var liquidRESetLRETLogic = liquidREContract.methods.setLRETLogic('0xcd17feb8aAcC39B49E57415b37eBdf7451C5c332', 0);
    var liquidRESetConverterLogic = liquidREContract.methods.setConverterLogic('0x2E681E2ACB8AFfb3AE1646D231437f627A69b6d6', 0);
    var liquidRESetStableToken = liquidREContract.methods.setStableToken('0x985f8d44332d463BE7d888E3676CFDC602B69a4C');
    var liquidRESetRENT = liquidREContract.methods.setRENT('0x0f8BeACa9af46adE4Eea86fE255a0d49A50cFEFC');

    var liquidRESetBancorFormulaPromise = liquidRESetBancorFormula.estimateGas({ from: web3.eth.defaultAccount }).then((gasEstimate) => {
        return liquidRESetBancorFormula.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        return liquidRESetLiquidFactory.estimateGas({ from: web3.eth.defaultAccount });
    }).then((gasEstimate) => {
        return liquidRESetLiquidFactory.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        return liquidRESetIREOLogic.estimateGas({ from: web3.eth.defaultAccount });
    }).then((gasEstimate) => {
        return liquidRESetIREOLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        return liquidRESetLRETLogic.estimateGas({ from: web3.eth.defaultAccount });
    }).then((gasEstimate) => {
        return liquidRESetLRETLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        return liquidRESetConverterLogic.estimateGas({ from: web3.eth.defaultAccount });
    }).then((gasEstimate) => {
        return liquidRESetConverterLogic.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        return liquidRESetStableToken.estimateGas({ from: web3.eth.defaultAccount });
    }).then((gasEstimate) => {
        return liquidRESetStableToken.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        return liquidRESetRENT.estimateGas({ from: web3.eth.defaultAccount });
    }).then((gasEstimate) => {
        return liquidRESetRENT.send({ from: web3.eth.defaultAccount, gas: gasEstimate + 100, gasPrice: gasPrice });
    }).then(() => {
        console.log('done');
    }).catch(console.error);

}).catch(console.error);
