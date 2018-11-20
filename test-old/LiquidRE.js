
const utils = require('./utils');

// accounts:
//  0: manager
//  1: manager
//  2: verifier
//  3: entity
//  4: entity
//  5: entity
//  6: trustee
//  7: trustee
//  8: trustee

contract('LiquidRE', (accounts) => {
    
    before(async () => {
        contracts = await utils.contracts();
    });

    it('add manager', async () => {
        let managers = await contracts.LiquidREContract.getManagers.call();
        assert.equal(managers.length, 1, "managers count is not correct");
        let res = await contracts.LiquidREContract.managerInfo.call(accounts[0]);
        assert.equal(res[0], true, "manager does not exist");
        await contracts.LiquidREContract.addManager(accounts[1]);
        managers = await contracts.LiquidREContract.getManagers.call();
        assert.equal(managers.length, 2, "managers count is not correct");
        res = await contracts.LiquidREContract.managerInfo.call(accounts[1]);
        assert.equal(res[0], true, "manager does not exist");
    });

    it('add verifier', async () => {
        let verifiers = await contracts.LiquidREContract.getVerifiers.call();
        assert.equal(verifiers.length, 0, "verifiers count is not correct");
        await contracts.LiquidREContract.addVerifier(accounts[2]);
        verifiers = await contracts.LiquidREContract.getVerifiers.call();
        assert.equal(verifiers.length, 1, "verifiers count is not correct");
        let res = await contracts.LiquidREContract.verifierInfo.call(accounts[2]);
        assert.equal(res[0], true, "verifier does not exist");
    });

    it('add entity', async () => {
        let entities = await contracts.LiquidREContract.getEntities.call();
        assert.equal(entities.length, 0, "entities count is not correct");
        await contracts.LiquidREContract.addEntity(accounts[3], 123);
        entities = await contracts.LiquidREContract.getEntities.call();
        assert.equal(entities.length, 1, "entities count is not correct");
        let res = await contracts.LiquidREContract.entityInfo.call(accounts[3]);
        assert.equal(res[1], 123, "entity does not exist");
        await contracts.LiquidREContract.addEntity(accounts[4], 1, {from: accounts[2]});
        entities = await contracts.LiquidREContract.getEntities.call();
        assert.equal(entities.length, 2, "entities count is not correct");
        res = await contracts.LiquidREContract.entityInfo.call(accounts[4]);
        assert.equal(res[1], 1, "entity does not exist");
    });

    it('should throw NewEntity event', async () => {
        let res = await contracts.LiquidREContract.addEntity(accounts[5], 123);
        assert(res.logs.length > 0 && res.logs[0].event == 'NewEntity');
    });

    it('add trustee', async () => {
        let trustees = await contracts.LiquidREContract.getTrustees.call();
        assert.equal(trustees.length, 0, "trustees count is not correct");
        await contracts.LiquidREContract.addTrustee(
            accounts[6], 
            'Trustee 1',
            'Address 1'
        );
        trustees = await contracts.LiquidREContract.getTrustees.call();
        assert.equal(trustees.length, 1, "trustees count is not correct");
        let res = await contracts.LiquidREContract.trusteeInfo.call(accounts[6]);
        assert.equal(res[0], true, "trustee does not exist");
        await contracts.LiquidREContract.addTrustee(
            accounts[7], 
            'Trustee 2',
            'Address 2'
        );
        trustees = await contracts.LiquidREContract.getTrustees.call();
        assert.equal(trustees.length, 2, "trustees count is not correct");
        res = await contracts.LiquidREContract.trusteeInfo.call(accounts[7]);
        assert.equal(res[0], true, "trustee does not exist");
    });

    it('should throw NewTrustee event', async () => {
        let res = await contracts.LiquidREContract.addTrustee(
            accounts[8], 
            'Trustee 2',
            'Address 2'
        );
        assert(res.logs.length > 0 && res.logs[0].event == 'NewTrustee');
    });

});
