pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./AntiERC20Sink.sol";

// not implemented yet, do not deploy
contract VotingLogic is AntiERC20Sink {

    uint8 public constant version = 0;

    LiquidREPointer public liquidREPointer;

    function VotingLogic(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }
}
