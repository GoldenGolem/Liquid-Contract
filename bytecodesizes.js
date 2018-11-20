var fs = require('fs');

fs.readdirSync('./solcbuild/').forEach(file => {
    if (file != 'abi' && file.slice(file.indexOf('.') + 1) == 'bin') {
        // console.log(file + ' bytes: ' + ((JSON.parse(fs.readFileSync('./build/contracts/' + file, 'utf8')).bytecode.length - 2) / 2));
        console.log(file + ' bytes: ' + (fs.readFileSync('./solcbuild/' + file, 'utf8').length / 2));
    }
});
