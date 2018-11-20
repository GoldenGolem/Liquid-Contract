const LiquidProperty = artifacts.require("LiquidProperty");
const utils = require('./Utils');

let testInputs = {
    minFundingGoal: 1 * 10 ** 18,
    maxFundingGoal: 10 * 10 ** 18,
    ireoDuration: 60 // seconds
};

contract('LiquidREFactory', (accounts) => {

    before(async () => {
        contracts = await utils.contracts();
        await utils.createData(contracts.LiquidREContract, accounts);
        startTime = await web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    });

    it('add liquid property', async () => {
        await contracts.LiquidFactoryContract.newLiquidProperty(
            testInputs.minFundingGoal,
            testInputs.maxFundingGoal,
            startTime + testInputs.ireoDuration,
            startTime + (testInputs.ireoDuration * 2),
            "Test Property Address", {
                from: accounts[1]
            }
        );
        let liquidProperties = await contracts.LiquidREContract.getProperties.call();
        assert.equal(liquidProperties.length, 1, "liquid property count is not correct");
        let property = LiquidProperty.at(liquidProperties[0]);
        assert.equal(await property.name.call(), "Test Property Address");
        assert.equal(await property.creatorEntity.call(), accounts[1]);
    });

});