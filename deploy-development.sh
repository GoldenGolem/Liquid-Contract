rm -r solcbuild
node ./fulldeploy.js development 1
cp -fa ./solcbuild/abi/* ../LiquidRE-DApp/imports/startup/both/contracts/
cp -f ./LiquidREPointerDevelopment.json ../LiquidRE-DApp/imports/startup/both/LiquidREPointerDevelopment.json
