var fs = require('fs');
var Web3 = require('web3');
var solc = require('solc');
var linker = require('solc/linker');
var HDWalletProvider = require('truffle-hdwallet-provider');

var providers = require('./providers.json');

if (!process.argv[2] || !process.argv[3]) {
    console.error('Missing network and gas price args...');
    return;
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
    console.error('Invalid network arg...');
    return;
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
    console.error('Fatal error on compile. Aborting...');
    return;
} else {
    if (!fs.existsSync('./solcbuild/abi')) {
        fs.mkdirSync('./solcbuild');
        fs.mkdirSync('./solcbuild/abi');
    }
    for (let contractName in output.contracts) {
        // console.log(contractName);
        var contractFileName = contractName.slice(contractName.lastIndexOf(':') + 1);
        fs.writeFileSync('./solcbuild/' + contractFileName + '.bin', output.contracts[contractName].bytecode);
        fs.writeFileSync('./solcbuild/' + contractFileName + '.abi', output.contracts[contractName].interface);
    }
}

for (contractNeededByDApp of ['LiquidREPointer', 'LiquidRE', 'LiquidFactory', 'LiquidProperty', 'IREOLogic', 'LRETLogic', 'ConverterLogic', 'TPEG', 'RENT', 'RENTLogic']) {
    fs.copyFileSync('./solcbuild/' + contractNeededByDApp + '.abi', './solcbuild/abi/' + contractNeededByDApp + 'ABI.json');
}

var contractNameKeys = {};

for (key in input) {
    let key2 = key.slice(key.lastIndexOf('/') + 1);
    let key3 = key2.slice(0, key2.lastIndexOf('.'));
    // console.log(key3);
    if (['SafeMath', 'LiquidRE', 'LiquidREPointer', 'BancorFormula', 'LiquidFactory', 'ConverterLogic', 'IREOLogic', 'LRETLogic', 'TPEG', 'RENT', 'RENTLogic'].indexOf(key3) != -1) {
        contractNameKeys[key3] = key + ':' + key3;
    }
}

var web3Contracts = {};
for (let contractName of ['SafeMath', 'LiquidRE', 'LiquidREPointer', 'BancorFormula', 'LiquidFactory', 'ConverterLogic', 'IREOLogic', 'LRETLogic', 'TPEG', 'RENT', 'RENTLogic']) {
    web3Contracts[contractName] = web3.eth.contract(JSON.parse(output.contracts[contractNameKeys[contractName]].interface));
}

var deployInfo = [{
//     'contractName': 'SafeMath',
//     'arguments': [],
//     'link': false
// },{
//     'contractName': 'LiquidRE',
//     'arguments': [],
//     'link': false
// },{
//     'contractName': 'BancorFormula',
//     'arguments': [],
//     'link': false
// },{
//     'contractName': 'LiquidREPointer',
//     'arguments': ['LiquidRE'],
//     'link': false
// },{
//     'contractName': 'LRETLogic',
//     'arguments': ['LiquidREPointer'],
//     'link': false
// },{
//     'contractName': 'LiquidFactory',
//     'arguments': ['LiquidREPointer'],
//     'link': true
// },{
//     'contractName': 'ConverterLogic',
//     'arguments': ['LiquidREPointer'],
//     'link': true
// },{
//     'contractName': 'IREOLogic',
//     'arguments': ['LiquidREPointer'],
//     'link': true
// },{
//     'contractName': 'TPEG',
//     'arguments': ['LiquidREPointer'],
//     'link': true
// },{
//     'contractName': 'RENT',
//     'arguments': ['LiquidREPointer'],
//     'link': true
// },{
    'contractName': 'RENTLogic',
    'arguments': ['LiquidREPointer', 'RENT'],
    'link': true
}];

var transactionInfo = [{
//     'functionName': 'setBancorFormula',
//     'arguments': ['BancorFormula']
// },{
//     'functionName': 'setLiquidFactory',
//     'arguments': ['LiquidFactory']
// },{
//     'functionName': 'setIREOLogic',
//     'arguments': ['IREOLogic'],
//     'version': 0
// },{
//     'functionName': 'setLRETLogic',
//     'arguments': ['LRETLogic'],
//     'version': 0
// },{
//     'functionName': 'setConverterLogic',
//     'arguments': ['ConverterLogic'],
//     'version': 0
// },{
//     'functionName': 'setStableToken',
//     'arguments': ['TPEG']
// },{
    'functionName': 'setRENTLogic',
    'arguments': ['RENTLogic']
}];

var deployedContracts = {};

deployedContracts['LiquidRE'] = web3.eth.contract(JSON.parse(output.contracts[contractNameKeys['LiquidRE']].interface)).at('0x19839ccFAEF807168d2b97862640fa506425df0F');
deployedContracts['LiquidREPointer'] = web3.eth.contract(JSON.parse(output.contracts[contractNameKeys['LiquidREPointer']].interface)).at('0x8998dFce1Ab4292fb3FE6FF9a122d6b1c6DF7c2a');
deployedContracts['RENT'] = web3.eth.contract(JSON.parse(output.contracts[contractNameKeys['RENT']].interface)).at('0x23CB54b1722d44B9C60fDcc94153146bDC62326F');

var linkObj = {};
linkObj[contractNameKeys['SafeMath']] = '0x72f5a958371572d30ef9751108b5ffad0c731c6a';

var deployNextContract = () => {
    let deployInfoContract = deployInfo[deployIndex];
    let bytecode = output.contracts[contractNameKeys[deployInfoContract.contractName]].bytecode;
    if (deployInfoContract.link) {
        bytecode = linker.linkBytecode(bytecode, linkObj);
    }
    let args = [];
    for (let arg of deployInfoContract.arguments) {
        args.push(deployedContracts[arg].address);
    }
    web3.eth.estimateGas({ data: web3Contracts[deployInfoContract.contractName].new.getData(...args, { data: '0x' + bytecode }) }, (err, res) => {
        if (err) {
            console.error('Error on gas estimate ' + deployInfoContract.contractName + ': ' + err);
            return;
        } else {
            deployedContracts[deployInfoContract.contractName] = web3Contracts[deployInfoContract.contractName].new(...args, { data: '0x' + bytecode , gas: res.valueOf() + 100, gasPrice: gasPrice }, logOrThrow);
        }
    });
};

var nextTransaction = () => {
    let args = [];
    for (let arg of transactionInfo[transactionIndex].arguments) {
        args.push(deployedContracts[arg].address);
    }
    if (typeof transactionInfo[transactionIndex].version !== 'undefined') {
        args.push(transactionInfo[transactionIndex].version);
    }
    deployedContracts['LiquidRE'][transactionInfo[transactionIndex].functionName].estimateGas(...args, (err, res) => {
        if (err) {
            console.error('Error on gas estimate LiquidRE.' + transactionInfo[transactionIndex].functionName + ': ' + err);
            return;
        } else {
            deployedContracts['LiquidRE'][transactionInfo[transactionIndex].functionName](...args, { gasPrice: gasPrice, gas: res.valueOf() + 100 }, transactionLogOrThrow);
        }
    });
};

var logOrThrow = (err, res) => {
    let contractName = deployInfo[deployIndex].contractName;
    if (err) {
        console.error('Error on deploy ' + contractName + ': ' + err);;
        return;
    } else {
        if (!res.address) {
            console.log('Deploying ' + contractName + ': ' + res.transactionHash);
        } else {
            console.log(contractName + ': ' + res.address);
            if (contractName == 'SafeMath') {
                linkObj[contractNameKeys['SafeMath']] = deployedContracts['SafeMath'].address;
            } else if (contractName == 'RENTLogic') {
                nextTransaction();
                return;
            }
            deployIndex++;
            deployNextContract();
        }
    }
};

var transactionLogOrThrow = (err, res) => {
    let functionName = transactionInfo[transactionIndex].functionName;
    if (err) {
        console.error('Transaction error: ' + functionName + ': ' + err);;
        return;
    } else {
        console.log(functionName + ': ' + res);
        if (functionName == 'setRENTLogic') {
            let addressFilename = './LiquidREPointer.json';
            if (process.argv[2] == 'ropsten') {
                addressFilename = './LiquidREPointerRopsten.json';
            } else if (process.argv[2] == 'development') {
                addressFilename = './LiquidREPointerDevelopment.json';
            } else if (process.argv[2] == 'localhost') {
                addressFilename = './LiquidREPointerLocal.json';
            }
            fs.writeFileSync(addressFilename, '{"address":"' + deployedContracts['LiquidREPointer'].address + '"}');
            console.log('Deploy completed...');
            return;
        }
        transactionIndex++;
        nextTransaction();
    }
};

var deployIndex = 0;
var transactionIndex = 0;

web3.eth.getAccounts((err, res) => {
    if (err) {
        console.error('Error on get accounts: ' + err);
    } else {
        web3.eth.defaultAccount = res[0];
        // web3.personal.unlockAccount(web3.eth.defaultAccount);
        deployNextContract();
    }
});
