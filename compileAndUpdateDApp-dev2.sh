rm -r build
truffle compile
truffle migrate --reset --network development2
cp -fa ./build/contracts/abi/* ../LiquidRE-DApp/imports/startup/both/contracts/
cp -f ./LiquidREPointerLocal.json ../LiquidRE-DApp/imports/startup/both/LiquidREPointerLocal.json
