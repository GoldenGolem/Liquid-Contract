rm -r solcbuild
node ./fulldeploy.js ropsten 50
cp -fa ./solcbuild/abi/* ../LiquidRE-DApp/imports/startup/both/contracts/
cp -f ./LiquidREPointerRopsten.json ../LiquidRE-DApp/imports/startup/both/LiquidREPointerRopsten.json
