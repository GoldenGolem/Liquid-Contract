rm -r build
truffle compile
truffle migrate --reset --network ropsten
cp -fa ./build/contracts/abi/* ../LiquidRE-DApp/imports/startup/both/contracts/
cp -f ./LiquidREPointerRopsten.json ../LiquidRE-DApp/imports/startup/both/LiquidREPointerRopsten.json
