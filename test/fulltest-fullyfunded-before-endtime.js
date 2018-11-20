const LiquidProperty = artifacts.require("LiquidProperty");
const utils = require('./Utils');

let testInputs = {
    minFundingGoal: 3 * 10 ** 18,
    maxFundingGoal: 10 * 10 ** 18,
    ireoDuration: 500 // seconds
};

// accounts:
//  0: admin
//  1: seller
//  2: trustee / bid winner
//  3: trustee
//  4: trustee
//  5: investor
//  6: investor
//  7: investor
//  8: investor
//  9: seller

contract("full test", (accounts) => {

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

    describe("liquid property", () => {

        it("create new liquid property", async () => {
            await contracts.LiquidFactoryContract.newLiquidProperty(
                testInputs.minFundingGoal,
                testInputs.maxFundingGoal,
                startTime + 50,
                startTime + testInputs.ireoDuration,
                "Test Property Address",
                true,
                '0x0',
                0, {
                    from: accounts[1]
                }
            );
            let liquidProperties = await contracts.LiquidREContract.getProperties.call();
            assert.equal(liquidProperties.length, 1, "liquid property count is not correct");
            property = LiquidProperty.at(liquidProperties[0]);
            assert.equal(await property.name.call(), "Test Property Address");
            assert.equal(await property.seller.call(), accounts[1]);
        });

    });

    describe('trustees bid', () => {

        it("throw error on non-trustee user", async () => {
            [isTrustee, , , ] = await contracts.LiquidREContract.trusteeInfo.call(accounts[9]);
            assert.equal(isTrustee, false);
            try {
                await contracts.IREOLogicContract.bid(property.address, 0.5 * 10 * 4, {
                    from: accounts[9]
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("trustee successful bid", async () => {
            await contracts.IREOLogicContract.bid(property.address, 0.5 * 10 * 4, {
                from: accounts[2]
            });
            let bidCount = await property.bidCount.call();
            assert.equal(bidCount, 1, "bids count is not correct");
            let bid = await property.bids.call(accounts[2]);
            assert.equal(bid[0], true, "bid does not exist");
            assert.equal(Number(bid[1]), (bidCount - 1), "bid index is not correct");
            assert.equal(Number(bid[2]), 0.5 * 10 * 4, "bid basis is not correct");
        });

        it("should trigger NewTrusteeBid event", async () => {
            let res = await contracts.IREOLogicContract.bid(property.address, 1 * 10 * 4, {
                from: accounts[3]
            });
            assert(res.logs.length > 0 && res.logs[0].event == 'NewTrusteeBid');
            bidCount = await property.bidCount.call();
            assert.equal(bidCount, 2, "bids count is not correct");
            bid = await property.bids.call(accounts[3]);
            assert.equal(bid[0], true, "bid does not exist");
            assert.equal(Number(bid[1]), (bidCount - 1), "bid index is not correct");
            assert.equal(Number(bid[2]), 1 * 10 * 4, "bid basis is not correct");
        })

    });

    describe("seller selects bid", () => {

        it("throw error on non-seller user", async () => {
            [isSeller, , , ] = await contracts.LiquidREContract.sellerInfo.call(accounts[5]);
            assert.equal(isSeller, false);
            try {
                await contracts.IREOLogicContract.selectBid(property.address, accounts[2], {
                    from: accounts[5]
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("throw error on seller user but not the property seller", async () => {
            [isSeller, , , ] = await contracts.LiquidREContract.sellerInfo.call(accounts[9]);
            assert.equal(isSeller, true);
            try {
                await contracts.IREOLogicContract.selectBid(property.address, accounts[2], {
                    from: accounts[9]
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("throw error on non-existing bid", async () => {
            try {
                await contracts.IREOLogicContract.selectBid(property.address, accounts[9], {
                    from: accounts[1]
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("should trigger ChosenTrusteeBid", async () => {
            let res = await contracts.IREOLogicContract.selectBid(property.address, accounts[2], {
                from: accounts[1]
            });
            assert(res.logs.length > 0 && res.logs[0].event == 'ChosenTrusteeBid');
            let trustee = await property.trustee.call();
            assert.equal(trustee, accounts[2], "Incorrect trustee value")
        });

    });

    describe("trustee approve IREO", () => {

        before(async () => {
            minFundingGoal = Number(await property.minFundingGoal.call());
            maxFundingGoal = Number(await property.maxFundingGoal.call());
            startTime = Number(await property.startTime.call());
            endTime = Number(await property.endTime.call());
        });

        it("throw error on non-trustee user", async () => {
            [isTrustee, , , ] = await contracts.LiquidREContract.trusteeInfo.call(accounts[9]);
            assert.equal(isTrustee, false);
            try {
                await contracts.IREOLogicContract.approveIREO(
                    property.address,
                    minFundingGoal,
                    maxFundingGoal,
                    startTime,
                    endTime,
                    true, {
                        from: accounts[9]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("throw error on trustee user but not the property assigned trustee", async () => {
            [isTrustee, , , ] = await contracts.LiquidREContract.trusteeInfo.call(accounts[3]);
            assert.equal(isTrustee, true);
            try {
                await contracts.IREOLogicContract.approveIREO(
                    property.address,
                    minFundingGoal,
                    maxFundingGoal,
                    startTime,
                    endTime,
                    true, {
                        from: accounts[3]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("change IREO status from Bidding to Funding", async () => {
            assert.equal(Number(await property.status.call()), utils.status.Bidding);
            let res = await contracts.IREOLogicContract.approveIREO(
                property.address,
                minFundingGoal,
                maxFundingGoal,
                startTime,
                endTime,
                true, {
                    from: accounts[2]
                });
            assert.equal(Number(await property.status.call()), utils.status.Funding);
            assert(res.logs.length > 0 && res.logs[0].event == 'IREOStatusChange');
        });

    });

    describe("send TPEGS to investors", () => {

        it('verify TPEGS balance', async () => {
            await contracts.TPEGContract.issue(accounts[5], 15 * 10 ** 18, {
                from: accounts[0]
            });
            await contracts.TPEGContract.issue(accounts[6], 15 * 10 ** 18, {
                from: accounts[0]
            });
            await contracts.TPEGContract.issue(accounts[7], 15 * 10 ** 18, {
                from: accounts[0]
            });
            await contracts.TPEGContract.issue(accounts[8], 15 * 10 ** 18, {
                from: accounts[0]
            });
            assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[5])).valueOf(), 15 * 10 ** 18, 'accounts[5] balance is not correct');
            assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[6])).valueOf(), 15 * 10 ** 18, 'accounts[6] balance is not correct');
            assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[7])).valueOf(), 15 * 10 ** 18, 'accounts[7] balance is not correct');
            assert.equal((await contracts.TPEGContract.balanceOf.call(accounts[8])).valueOf(), 15 * 10 ** 18, 'accounts[8] balance is not correct');
        });

    });

    describe("evm time", () => {

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

    });

    describe("fund IREO", () => {

        it("throw error on non-investor user", async () => {
            [isInvestor, , , ] = await contracts.LiquidREContract.investorInfo.call(accounts[2]);
            assert.equal(isInvestor, false);
            try {
                await contracts.IREOLogicContract.contribute(
                    property.address,
                    100, {
                        from: accounts[2]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("successful investor contribution", async () => {
            let contribution = 1 * 10 ** 18;
            await contracts.TPEGContract.approve(contracts.IREOLogicContract.address, accounts[5], {
                from: accounts[5]
            });

            [isInvestor, , , ] = await contracts.LiquidREContract.investorInfo.call(accounts[5]);
            assert.equal(isInvestor, true);
            await contracts.IREOLogicContract.contribute(
                property.address,
                contribution, {
                    from: accounts[5]
                });
            assert.equal(Number(await property.contributorCount.call()), 1);
            assert.equal(Number(await property.contributions.call(accounts[5])), contribution);
            assert.equal(Number(await property.beneficiaryExists.call(accounts[5])), true);
            assert.equal(Number(await property.balanceOf.call(accounts[5])), contribution);
        });

        it("should trigger MinGoalReached and Contribution event", async () => {
            let contribution = 5 * 10 ** 18;
            await contracts.TPEGContract.approve(contracts.IREOLogicContract.address, accounts[6], {
                from: accounts[6]
            });

            [isInvestor, , , ] = await contracts.LiquidREContract.investorInfo.call(accounts[6]);
            assert.equal(isInvestor, true);
            let res = await contracts.IREOLogicContract.contribute(
                property.address,
                contribution, {
                    from: accounts[6]
                });
            assert.equal(Number(await property.contributions.call(accounts[6])), contribution);
            assert.equal(Number(await property.beneficiaryExists.call(accounts[6])), true);
            assert.equal(Number(await property.balanceOf.call(accounts[6])), contribution);
            assert(res.logs.length > 0 && res.logs[0].event == 'MinGoalReached');
            assert(res.logs.length > 0 && res.logs[1].event == 'Contribution');
        });

        it("should trigger MaxGoalReached and Contribution event", async () => {
            let contribution = 8 * 10 ** 18;
            let amountRaised = Number(await property.amountRaised.call());
            await contracts.TPEGContract.approve(contracts.IREOLogicContract.address, accounts[7], {
                from: accounts[7]
            });

            [isInvestor, , , ] = await contracts.LiquidREContract.investorInfo.call(accounts[7]);
            assert.equal(isInvestor, true);
            let res = await contracts.IREOLogicContract.contribute(
                property.address,
                contribution, {
                    from: accounts[7]
                });

            let finalContribution = testInputs.maxFundingGoal - amountRaised;
            assert.equal(Number(await property.contributions.call(accounts[7])), finalContribution);
            assert.equal(Number(await property.beneficiaryExists.call(accounts[7])), true);
            assert.equal(Number(await property.balanceOf.call(accounts[7])), finalContribution);
            assert(res.logs.length > 0 && res.logs[0].event == 'MaxGoalReached');
            assert(res.logs.length > 0 && res.logs[1].event == 'Contribution');
        });

    });

    describe("trustee withdraw", () => {

        it("throw error on non-trustee user", async () => {
            try {
                await contracts.IREOLogicContract.withdrawToTrustee(
                    property.address, {
                        from: accounts[3]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("change property status from Funding to Withdrawn", async () => {
            let trusteeInitialTPEG = (await contracts.TPEGContract.balanceOf.call(accounts[2])).valueOf();
            assert.equal(trusteeInitialTPEG, 0);
            await contracts.IREOLogicContract.withdrawToTrustee(property.address, {
                from: accounts[2]
            });
            let trusteeFinalTPEG = (await contracts.TPEGContract.balanceOf.call(accounts[2])).valueOf();
            assert.equal(trusteeFinalTPEG, testInputs.maxFundingGoal * 0.9);
            assert.equal(Number(await property.status.call()), utils.status.Withdrawn);
        });

        it('check converter TPEG balance', async () => {
            let propertyTPEG = (await contracts.TPEGContract.balanceOf.call(property.address)).valueOf();
            assert.equal(propertyTPEG, testInputs.maxFundingGoal * 0.1);
        });

    });

    describe("change LRET status to Trading", () => {

        it("throw error on non-trustee user", async () => {
            try {
                await contracts.LRETLogicContract.toggleTransfers(
                    property.address, true, {
                        from: accounts[3]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("on trading status", async () => {
            await contracts.LRETLogicContract.toggleTransfers(
                property.address, true, {
                    from: accounts[2]
                });
            assert.equal(Number(await property.status.call()), utils.status.Trading);
        });

    });

    describe("investor buys LRET", () => {

        it("throw error on non-investor user", async () => {
            [isInvestor, , , ] = await contracts.LiquidREContract.investorInfo.call(accounts[9]);
            assert.equal(isInvestor, false);
            try {
                await contracts.ConverterLogicContract.buy(
                    property.address,
                    5 * 10 ** 18,
                    1, {
                        from: accounts[9]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it("should have correct amounts of LRET", async () => {
            let accounts5InitialLRETBalance = (await property.balanceOf.call(accounts[5])).valueOf();        
            let accounts5Deposit = 5 * 10 ** 18;
            await contracts.TPEGContract.approve(contracts.ConverterLogicContract.address, accounts5Deposit, {
                from: accounts[5]
            });
            await contracts.ConverterLogicContract.buy(property.address, accounts5Deposit, 1, {from: accounts[5], gasPrice: 22000000000});
            let accounts5FinalLRETBalance = (await property.balanceOf.call(accounts[5])).valueOf();
            assert(accounts5InitialLRETBalance < accounts5FinalLRETBalance);


            let accounts8InitialLRETBalance = (await property.balanceOf.call(accounts[8])).valueOf();        
            let accounts8Deposit = 5 * 10 ** 18;
            await contracts.TPEGContract.approve(contracts.ConverterLogicContract.address, accounts8Deposit, {
                from: accounts[8]
            });
            await contracts.ConverterLogicContract.buy(property.address, accounts8Deposit, 1, {from: accounts[8], gasPrice: 22000000000});
            let accounts8FinalLRETBalance = (await property.balanceOf.call(accounts[8])).valueOf();
            assert(accounts8InitialLRETBalance < accounts8FinalLRETBalance);
        });

    });

    describe("investor sells LRET", () => {

        it("throw error on amount greater than balance", async () => {
            try {
                await contracts.ConverterLogicContract.sell(
                    property.address,
                    50 * 10 ** 18,
                    1, {
                        from: accounts[5]
                    });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });


        it("should have correct amounts of LRET and TPEG", async () => {
            let accounts5InitialLRETBalance = Number(await property.balanceOf.call(accounts[5]));        
            let accounts5InitialTPEGBalance = Number(await contracts.TPEGContract.balanceOf.call(accounts[5]));        
            let accounts5Sell = 1 * 10 ** 18;
            await contracts.ConverterLogicContract.sell(property.address, accounts5Sell, 1, {from: accounts[5], gasPrice: 22000000000});
            let accounts5FinalLRETBalance = Number(await property.balanceOf.call(accounts[5]));
            let accounts5FinalTPEGBalance = Number(await contracts.TPEGContract.balanceOf.call(accounts[5]));
            assert(accounts5FinalLRETBalance <= (accounts5InitialLRETBalance - accounts5Sell));
            assert(accounts5FinalTPEGBalance > accounts5InitialTPEGBalance);
        });

    });

});