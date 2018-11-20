
const LiquidRE = artifacts.require('LiquidRE');
const LiquidREPointer = artifacts.require('LiquidREPointer');
const BancorFormula = artifacts.require('BancorFormula');
const LiquidFactory = artifacts.require('LiquidFactory');
const ConverterLogic = artifacts.require('ConverterLogic');
const IREOLogic = artifacts.require('IREOLogic');
const LRETLogic = artifacts.require('LRETLogic');
const TPEG = artifacts.require('TPEG');
const RENT = artifacts.require('RENT');
const RENTLogic = artifacts.require('RENTLogic');

function isException(error) {
    let strError = error.toString();
    return strError.includes('VM Exception') || strError.includes('invalid opcode') || strError.includes('invalid JUMP');
}

function ensureException(error) {
    assert(isException(error), error.toString());
}

let createContracts = async () => {
    LiquidREContract = await LiquidRE.new();
    LiquidREPointerContract = await LiquidREPointer.new(LiquidREContract.address);
    BancorFormulaContract = await BancorFormula.new();
    LiquidFactoryContract = await LiquidFactory.new(LiquidREPointerContract.address);
    IREOLogicContract = await IREOLogic.new(LiquidREPointerContract.address);
    LRETLogicContract = await LRETLogic.new(LiquidREPointerContract.address);
    ConverterLogicContract = await ConverterLogic.new(LiquidREPointerContract.address);
    TPEGContract = await TPEG.new(LiquidREPointerContract.address);
    RENTContract = await RENT.new(LiquidREPointerContract.address);
    RENTLogicContract = await RENTLogic.new(LiquidREPointerContract.address, RENTContract.address);

    await LiquidREContract.setBancorFormula(BancorFormulaContract.address);
    await LiquidREContract.setLiquidFactory(LiquidFactoryContract.address);
    await LiquidREContract.setIREOLogic(IREOLogicContract.address, 0);
    await LiquidREContract.setLRETLogic(LRETLogicContract.address, 0);
    await LiquidREContract.setConverterLogic(ConverterLogicContract.address, 0);
    await LiquidREContract.setStableToken(TPEGContract.address);
    await LiquidREContract.setRENTLogic(RENTLogicContract.address);

    return {
        LiquidREContract: LiquidREContract,
        LiquidREPointerContract: LiquidREPointerContract,
        LiquidFactoryContract: LiquidFactoryContract,
        IREOLogicContract: IREOLogicContract,
        LRETLogicContract: LRETLogicContract,
        ConverterLogicContract: ConverterLogicContract,
        TPEGContract: TPEGContract,        
        RENTContract: RENTContract,        
        RENTLogicContract: RENTLogicContract,        
    }
};

let createInitialData = async (LiquidRE, accounts) => {
    // accounts:
    //  1: seller
    //  2: trustee / bid winner
    //  3: trustee
    //  4: trustee
    //  5: investor
    //  6: investor
    //  7: investor
    //  8: investor
    //  9: seller
    await LiquidRE.addSeller(accounts[1]);
    await LiquidRE.addTrustee(accounts[2], 'Trustee 1', 'Trustee 1 mailing address');
    await LiquidRE.addTrustee(accounts[3], 'Trustee 2', 'Trustee 2 mailing address');
    await LiquidRE.addTrustee(accounts[4], 'Trustee 3', 'Trustee 3 mailing address');
    await LiquidRE.addInvestor(accounts[5], 1);
    await LiquidRE.addInvestor(accounts[6], 2);
    await LiquidRE.addInvestor(accounts[7], 3);
    await LiquidRE.addInvestor(accounts[8], 4);
    await LiquidRE.addSeller(accounts[9]);    
}

let status = {
    Bidding: 0, // trustees are bidding on it. it only proceeds to funding when the seller chooses a trustee, and the trustee accepts and sets min/max/start/end/etc
    Funding: 1, // if funding AND now is between start and end, investors can contribute
    Withdrawn: 2, // trustee withdrew, 
    Trading: 3, // trustee enabled trading after withdrawal
    Frozen: 4, // trustee has frozen trading
    Failed: 5,
    CancelledBySeller: 6, // seller that created it decided to cancel it before choosing a trustee
    CancelledByTrustee: 7, // trustee decided to cancel it
    Dissolve: 8 // trustee dissolved trust
}

module.exports = {
    status: status,
    createData: createInitialData,
    contracts: createContracts,
    zeroAddress: '0x0000000000000000000000000000000000000000',
    isException: isException,
    ensureException: ensureException
};
