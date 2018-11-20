/**
 * Full test cases fully funded before the end time
 */

const LiquidProperty = artifacts.require("LiquidProperty");
const utils = require('./Utils');

let testInputs = {
    minFundingGoal: 1 * 10 ** 18,
    maxFundingGoal: 10 * 10 ** 18,
    ireoDuration: 300 // seconds
};

// accounts:
//  0: manager
//  1: entity/property owner
//  2: entity / share holder
//  3: trustee / bid winner
//  4: trustee
//  5: entity
//  6: entity
//  7: entity / share holder
//  8: entity
//  9: entity / share holder

contract("full test fully funded before the end time", (accounts) => {

    before(async () => {
        contracts = await utils.contracts();
        await utils.createData(contracts.LiquidREContract, accounts);
        await web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: Date.now() // just a random unique ID, doesn't need to be time related
        });
        startTime = await web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    });

    it("add liquid property", async () => {
        await contracts.LiquidFactoryContract.newLiquidProperty(
            testInputs.minFundingGoal,
            testInputs.maxFundingGoal,
            startTime + 50,
            startTime + testInputs.ireoDuration,
            "Test Property Address", {
                from: accounts[1]
            }
        );
        let liquidProperties = await contracts.LiquidREContract.getProperties.call();
        assert.equal(liquidProperties.length, 1, "liquid property count is not correct");
        property = LiquidProperty.at(liquidProperties[0]);
        assert.equal(await property.name.call(), "Test Property Address");
        assert.equal(await property.creatorEntity.call(), accounts[1]);
    });

    it("have trustees bid", async () => {
        await contracts.IREOLogicContract.bid(property.address, 0.5 * 10 * 4, {
            from: accounts[3]
        });
        let bidCount = await property.bidCount.call();
        assert.equal(bidCount, 1, "bids count is not correct");
        let bid = await property.bids.call(accounts[3]);
        assert.equal(bid[0], true, "bid does not exist");
        assert.equal(Number(bid[1]), 0.5 * 10 * 4, "bid basis is not correct");
        assert.equal(Number(bid[2]), (bidCount - 1), "bid index is not correct");

        await contracts.IREOLogicContract.bid(property.address, 1 * 10 * 4, {
            from: accounts[4]
        });
        bidCount = await property.bidCount.call();
        assert.equal(bidCount, 2, "bids count is not correct");
        bid = await property.bids.call(accounts[4]);
        assert.equal(bid[0], true, "bid does not exist");
        assert.equal(Number(bid[1]), 1 * 10 * 4, "bid basis is not correct");
        assert.equal(Number(bid[2]), (bidCount - 1), "bid index is not correct");
    });

    it('have property owner select bid winner', async () => {
        await contracts.IREOLogicContract.selectBid(property.address, accounts[3], {
            from: accounts[1]
        });
        assert.equal(await property.trustee.call(), accounts[3]);
        assert.equal(Number(await property.trusteeFee.call()), 0.5 * 10 * 4);
        assert.equal(await property.status.call(), utils.status.Funding);
    });

    it('give TPEGs to entities so they can fund IREO', async () => {
        await contracts.TPEGContract.issue(accounts[2], 15 * 10 ** 18, {
            from: accounts[2]
        });
        await contracts.TPEGContract.issue(accounts[5], 15 * 10 ** 18, {
            from: accounts[5]
        });
        await contracts.TPEGContract.issue(accounts[6], 15 * 10 ** 18, {
            from: accounts[6]
        });
        await contracts.TPEGContract.issue(accounts[7], 15 * 10 ** 18, {
            from: accounts[7]
        });
        await contracts.TPEGContract.issue(accounts[8], 13 * 10 ** 18, {
            from: accounts[8]
        });
        await contracts.TPEGContract.issue(accounts[9], 110 * 10 ** 18, {
            from: accounts[9]
        });
        assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[2])).valueOf(), 15 * 10 ** 18, 'accounts[2] balance is not correct');
        assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[5])).valueOf(), 15 * 10 ** 18, 'accounts[5] balance is not correct');
        assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[6])).valueOf(), 15 * 10 ** 18, 'accounts[6] balance is not correct');
        assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[7])).valueOf(), 15 * 10 ** 18, 'accounts[7] balance is not correct');
        assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[8])).valueOf(), 13 * 10 ** 18, 'accounts[8] balance is not correct');
        assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[9])).valueOf(), 110 * 10 ** 18, 'accounts[9] balance is not correct');
    });

    it('advance evm time', async () => {
        let initialTime = await web3.eth.getBlock(web3.eth.blockNumber).timestamp;
        await web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [testInputs.ireoDuration / 2], // seconds
            id: Date.now() + 1 // just a random unique ID, doesn't need to be time related
        });
        await web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: Date.now() + 2 // just a random unique ID, doesn't need to be time related
        });
        let laterTime = await web3.eth.getBlock(web3.eth.blockNumber).timestamp;
        assert((initialTime + (testInputs.ireoDuration / 2)) <= laterTime, 'evm time not advanced');
    });

    it('fund IREO with TPEGs', async () => {

        let accounts2Contribution = 2 * 10 ** 18;
        await contracts.TPEGContract.approve(property.address, accounts2Contribution, {
            from: accounts[2]
        });
        await contracts.IREOLogicContract.contribute(property.address, accounts2Contribution, {
            from: accounts[2]
        });
        assert.equal(accounts2Contribution, (await property.ireoContributions.call(accounts[2])).valueOf(), 'accounts[2] contribution amount is incorrect');
        assert.equal(1, (await property.ireoContributorCount.call()).valueOf(), 'contributor count is incorrect');
        assert.equal((await property.balanceOf.call(accounts[2])).valueOf(), accounts2Contribution);
        
        let accounts7Contribution = 3 * 10 ** 18;
        await contracts.TPEGContract.approve(property.address, accounts7Contribution, {
            from: accounts[7]
        });
        await contracts.IREOLogicContract.contribute(property.address, accounts7Contribution, {
            from: accounts[7]
        });
        assert.equal(accounts7Contribution, (await property.ireoContributions.call(accounts[7])).valueOf(), 'accounts[7] contribution amount is incorrect');
        assert.equal(2, (await property.ireoContributorCount.call()).valueOf(), 'contributor count is incorrect');
        assert.equal((await property.balanceOf.call(accounts[7])).valueOf(), accounts7Contribution);

        let accounts9Contribution = 6 * 10 ** 18;
        await contracts.TPEGContract.approve(property.address, accounts9Contribution, {
            from: accounts[9]
        });
        await contracts.IREOLogicContract.contribute(property.address, accounts9Contribution, {
            from: accounts[9]
        });
        assert.equal(accounts9Contribution - (1 * 10 ** 18), (await property.ireoContributions.call(accounts[9])).valueOf(), 'accounts[9] contribution amount is incorrect');
        assert.equal(3, (await property.ireoContributorCount.call()).valueOf(), 'contributor count is incorrect');        
        assert.equal((await property.balanceOf.call(accounts[9])).valueOf(), accounts9Contribution);
    });

    it('fund IREO with TPEGs should fail', async () => {
        let accounts8Contribution = 1 * 10 ** 18;
        await contracts.TPEGContract.approve(property.address, accounts8Contribution, {
            from: accounts[8]
        });
        try {
            await contracts.IREOLogicContract.contribute(property.address, accounts8Contribution, {
                from: accounts[8]
            });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should be fully funded', async () => {
        assert.equal(Number(await property.amountRaised.call()), testInputs.maxFundingGoal);
        assert.equal((await property.status.call()).valueOf(), utils.status.Closing);
    });

    it('have trustee withdraw', async () => {
        let trusteeInitialTPEG = (await contracts.TPEGContract.balanceOf.call(accounts[3])).valueOf();
        assert.equal(trusteeInitialTPEG, 0, 'trustee initial tpeg balance mismatch');        
        await contracts.IREOLogicContract.withdrawToTrustee(property.address, {from: accounts[3]});
        let trusteeFinalTPEG = (await contracts.TPEGContract.balanceOf.call(accounts[3])).valueOf();
        assert.equal(trusteeFinalTPEG, testInputs.maxFundingGoal * 0.9, 'trustee final tpeg balance mismatch');
    });

    it('check converter tpeg balance', async () => {
        let propertyTPEG = (await contracts.TPEGContract.balanceOf.call(property.address)).valueOf();
        assert.equal(propertyTPEG, testInputs.maxFundingGoal * 0.1, 'property tpeg balance mismatch');        
    });

    it('check if trading disabled', async () => {
        assert((await property.status.call()).valueOf() != utils.status.Trading, "trading enabled");
    });

    it('have trustee enable trading', async () => {
        await contracts.LRETLogicContract.toggleTransfers(property.address, true, {from: accounts[3]});
        assert.equal((await property.status.call()).valueOf(), utils.status.Trading, 'trading disabled');
    });

    it('have entities buy lrets', async () => {
        let accounts5InitialLRETBalance = (await property.balanceOf.call(accounts[5])).valueOf();        
        let accounts5Deposit = 5 * 10 ** 18;
        await contracts.TPEGContract.approve(property.address, accounts5Deposit, {
            from: accounts[5]
        });
        await contracts.ConverterLogicContract.buy(property.address, accounts5Deposit, 1, {from: accounts[5], gasPrice: 22000000000});
        let accounts5FinalLRETBalance = (await property.balanceOf.call(accounts[5])).valueOf();
        assert(accounts5InitialLRETBalance < accounts5FinalLRETBalance, 'accounts[5] lret balance didnt change on buy');
        
        // let accounts6InitialLRETBalance = (await property.balanceOf.call(accounts[6])).valueOf();        
        // let accounts6Deposit = 3 * 10 ** 18;
        // await contracts.TPEGContract.approve(property.address, accounts6Deposit, {
        //     from: accounts[6]
        // });
        // await contracts.ConverterLogicContract.buy(property.address, accounts6Deposit, 1, {from: accounts[6], gasPrice: 22000000000});
        // let accounts6FinalLRETBalance = (await property.balanceOf.call(accounts[6])).valueOf();        
        // assert(accounts6InitialLRETBalance < accounts6FinalLRETBalance, 'accounts[6] lret balance didnt change on buy'); 
    });

});