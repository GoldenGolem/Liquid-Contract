pragma solidity ^0.4.21;

import "./IERC20Token.sol";

contract ILiquidRE {
    function isManager(address _address) public view returns (bool);
}

contract ILiquidREPointer {
    ILiquidRE public liquidRE;
}

contract AntiERC20Sink {

    ILiquidREPointer liquidREPointer;

    function AntiERC20Sink() public {}

    function transferERC20Token(IERC20Token _token, address _to, uint256 _amount) public {
        require(liquidREPointer.liquidRE().isManager(msg.sender));
        assert(_token.transfer(_to, _amount));
    }
}
