const TPEG = artifacts.require('TPEG');
const LiquidRE = artifacts.require('LiquidRE');
const BancorFormula = artifacts.require('BancorFormula');
const LiquidFactory = artifacts.require('LiquidFactory');
const IREOLogic = artifacts.require('IREOLogic');
const LRETLogic = artifacts.require('LRETLogic');
const ConverterLogic = artifacts.require('ConverterLogic');

function isException(error) {
    let strError = error.toString();
    return strError.includes('VM Exception') || strError.includes('invalid opcode') || strError.includes('invalid JUMP');
}

function ensureException(error) {
    assert(isException(error), error.toString());
}

let createContracts = async () => {
    TPEGContract = await TPEG.new('TPEG', 'TPEG');
    LiquidREContract = await LiquidRE.new();
    BancorFormulaContract = await BancorFormula.new();
    LiquidFactoryContract = await LiquidFactory.new(LiquidREContract.address);
    IREOLogicContract = await IREOLogic.new(LiquidREContract.address);
    LRETLogicContract = await LRETLogic.new(LiquidREContract.address);
    ConverterLogicContract = await ConverterLogic.new(LiquidREContract.address);

    await LiquidREContract.setBancorFormula(BancorFormulaContract.address);
    await LiquidREContract.setLiquidFactory(LiquidFactoryContract.address);
    await LiquidREContract.setIREOLogic(IREOLogicContract.address);
    await LiquidREContract.setLRETLogic(LRETLogicContract.address);
    await LiquidREContract.setConverterLogic(ConverterLogicContract.address);
    await LiquidREContract.setStableToken(TPEGContract.address);

    return {
        TPEGContract: TPEGContract,
        LiquidREContract: LiquidREContract,
        LiquidFactoryContract: LiquidFactoryContract,
        IREOLogicContract: IREOLogicContract,
        LRETLogicContract: LRETLogicContract,
        ConverterLogicContract: ConverterLogicContract
    }
};

let createInitialData = async (LiquidRE, accounts) => {
    // accounts:
    //  1: entity
    //  2: entity
    //  3: trustee
    //  4: trustee
    //  5: entity
    //  6: entity
    //  7: entity
    //  8: entity
    //  9: entity
    await LiquidRE.addEntity(accounts[1], 123);
    await LiquidRE.addEntity(accounts[2], 456);
    await LiquidRE.addEntity(accounts[5], 456);
    await LiquidRE.addEntity(accounts[6], 456);
    await LiquidRE.addEntity(accounts[7], 456);
    await LiquidRE.addEntity(accounts[8], 456);
    await LiquidRE.addEntity(accounts[9], 456);
    await LiquidRE.addTrustee(accounts[3], 'Trustee 1', 'Trustee Address 1');
    await LiquidRE.addTrustee(accounts[4], 'Trustee 2', 'Trustee Address 2');
}


let status = {
    Bidding: 0, // trustees are bidding on it
    Pending: 1, // trustee chosen, awaiting his approval
    Funding: 2, // trustee has approved, now funding
    Closing: 3, // now closing and creating trust
    withdrawn: 4, // trustee withdrew, 
    Trading: 5,
    Frozen: 6, // trustee has frozen trading
    Failed: 7,
    CancelledByCreator: 8, // entity that created it decided to cancel it
    CancelledByTrustee: 9 // trustee decided to cancel it
}

module.exports = {
    status: status,
    createData: createInitialData,
    contracts: createContracts,
    zeroAddress: '0x0000000000000000000000000000000000000000',
    isException: isException,
    ensureException: ensureException
};
