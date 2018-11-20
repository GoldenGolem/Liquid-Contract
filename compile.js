var fs = require('fs');
var solc = require('solc');

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

for (contractNeededByDApp of ['LiquidREPointer', 'LiquidRE', 'LiquidFactory', 'LiquidProperty', 'IREOLogic', 'LRETLogic', 'ConverterLogic', 'TPEG']) {
    fs.copyFileSync('./solcbuild/' + contractNeededByDApp + '.abi', './solcbuild/abi/' + contractNeededByDApp + 'ABI.json');
}
