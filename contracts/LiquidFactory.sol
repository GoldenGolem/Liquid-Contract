pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./LiquidRE.sol";
import "./LiquidProperty.sol";
import "./IERC20Token.sol";
import "./AntiERC20Sink.sol";

contract LiquidFactory is AntiERC20Sink {

    uint8 public constant version = 0;

    LiquidREPointer public liquidREPointer;

    function LiquidFactory(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }

    modifier sellerOnly() {
        require(liquidREPointer.liquidRE().isSeller(msg.sender));
        _;
    }

    modifier active() {
        require(liquidREPointer.liquidRE().active());
        _;
    }

    function newLiquidProperty(
        uint256 _minFundingGoal,
        uint256 _maxFundingGoal,
        uint40 _startTime,
        uint40 _endTime,
        string _streetAddress,
        bool _globalWhitelistEnabled,
        address _trustee,
        uint16 _trusteeFee
    ) public active sellerOnly returns (address) {
        require(_maxFundingGoal >= _minFundingGoal && _startTime > now && _endTime > _startTime && bytes(_streetAddress).length > 0 && _trusteeFee < 10000);
        // liquidREPointer.liquidRE().gasToken().burn(msg.sender, liquidREPointer.liquidRE().newPropertyFee());
        LiquidProperty property = new LiquidProperty(_minFundingGoal, _maxFundingGoal, _startTime, _endTime, _streetAddress, msg.sender, _globalWhitelistEnabled, liquidREPointer);
        if (liquidREPointer.liquidRE().isTrustee(_trustee)) {
            property.setTrustee(_trustee);
            property.setTrusteeFee(_trusteeFee);
            if (msg.sender == _trustee) {
                property.setStatus(LiquidProperty.Status.Funding);
            }
        }
        liquidREPointer.liquidRE().factoryAddProperty(address(property));
        return address(property);
    }
}
