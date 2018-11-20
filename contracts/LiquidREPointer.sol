pragma solidity ^0.4.21;

import "./LiquidRE.sol";
import "./IERC20Token.sol";
import "./AntiERC20Sink.sol";

contract LiquidREPointer is AntiERC20Sink {

    LiquidRE public liquidRE;

    event LiquidREUpgrade(address liquidRE);

    function LiquidREPointer(LiquidRE _liquidRE) public {
        liquidRE = _liquidRE;
    }

    function setLiquidRE(LiquidRE _liquidRE) public {
        require(liquidRE.isAdministrator(msg.sender));
        liquidRE = _liquidRE;
        emit LiquidREUpgrade(_liquidRE);
    }
}
