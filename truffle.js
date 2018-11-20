let HDWalletProvider = require("truffle-hdwallet-provider");
let mnemonic = "monitor sheriff gasp language whale flavor pig unaware segment hidden useful twin";
let infuraURL = "https://ropsten.infura.io/4Qs56NDu0KAYm8uyQrIK";
let provider = new HDWalletProvider(mnemonic, infuraURL);

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      // this prevents being able to debug a transaction in remix ide. can be re-enabled after contracts are debugged
      // runs: 500
      runs: 200
    }
  },
  networks: {
    ropsten: {
      network_id: 3,
      provider: provider,
      from: provider.address,
      gas: 4600000,
      // gas: 35300000,
      // gasPrice: 100000000000
      // gas: 4600000,
      // web3.eth.getBlock('latest', (err, res) => console.log(res.gasLimit))
      // gasPrice: 22000000000,
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      // gas: 6721975,
      //gas: 4712388,
      // gasPrice: 22000000000
    },
    development2: {
      host: "76.178.151.137",
      port: 8545,
      network_id: "*"
    }
  },
  rpc: {
    host: 'localhost',
    port: 8080
  }
};
