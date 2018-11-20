var fs = require('fs');

const SafeMath = artifacts.require('SafeMath');
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

module.exports = async (deployer, network) => {
    await deployer.deploy(SafeMath);
    await deployer.link(SafeMath, [LiquidFactory, ConverterLogic, IREOLogic, TPEG, RENT, RENTLogic]);
    await deployer.deploy(LiquidRE);
    await deployer.deploy(LiquidREPointer, LiquidRE.address);
    await deployer.deploy(BancorFormula);
    await deployer.deploy(LiquidFactory, LiquidREPointer.address);
    await deployer.deploy(IREOLogic, LiquidREPointer.address);
    await deployer.deploy(LRETLogic, LiquidREPointer.address);
    await deployer.deploy(ConverterLogic, LiquidREPointer.address);
    await deployer.deploy(TPEG, LiquidREPointer.address);
    await deployer.deploy(RENT, LiquidREPointer.address);
    await deployer.deploy(RENTLogic, LiquidREPointer.address, RENT.address);
    let liquidRE = await LiquidRE.deployed();
    await liquidRE.setBancorFormula(BancorFormula.address);
    await liquidRE.setLiquidFactory(LiquidFactory.address);
    await liquidRE.setIREOLogic(IREOLogic.address, 0);
    await liquidRE.setLRETLogic(LRETLogic.address, 0);
    await liquidRE.setConverterLogic(ConverterLogic.address, 0);
    await liquidRE.setStableToken(TPEG.address);
    await liquidRE.setRENTLogic(RENTLogic.address);
};
