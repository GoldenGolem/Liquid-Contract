pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./LiquidRE.sol";
import "./SafeMath.sol";
import "./IERC20Token.sol";
import "./AntiERC20Sink.sol";

contract TPEG is AntiERC20Sink {

    using SafeMath for uint256;

    uint8 public constant version = 0;

    LiquidREPointer public liquidREPointer;

    bool public anyCanTransfer;
    bool public investorsCanTransfer;

    string public constant name = "TPEG";
    string public constant symbol = "TPEG";
    uint8 public constant decimals = 18;

    uint256 public totalSupply = 0;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event TransferRestrictionsChange(bool anyCanTransfer, bool investorsCanTransfer);
    
    function TPEG(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }

    modifier managementOnly() {
        require(liquidREPointer.liquidRE().isManager(msg.sender));
        _;
    }

    function changeTransferRestrictions(bool _anyCanTransfer, bool _investorsCanTransfer) public managementOnly {
        anyCanTransfer = _anyCanTransfer;
        investorsCanTransfer = _investorsCanTransfer;
        emit TransferRestrictionsChange(_anyCanTransfer, _investorsCanTransfer);
    }

    function issue(address _to, uint256 _amount) public managementOnly {
        totalSupply = totalSupply.add(_amount);
        balanceOf[_to] = balanceOf[_to].add(_amount);
        emit Transfer(this, _to, _amount);
    }

    function destroy(address _from, uint256 _amount) public managementOnly {
        balanceOf[_from] = balanceOf[_from].sub(_amount);
        totalSupply = totalSupply.sub(_amount);
        emit Transfer(_from, this, _amount);
    }
    
    function transfer(address _to, uint256 _amount) public returns (bool) {
        if (!anyCanTransfer) {
            if (!investorsCanTransfer) {
                require(liquidREPointer.liquidRE().isProperty(msg.sender) || msg.sender == address(liquidREPointer.liquidRE().rentLogic().rent()));
            } else {
                require(liquidREPointer.liquidRE().isProperty(msg.sender) || (liquidREPointer.liquidRE().isInvestor(msg.sender) && liquidREPointer.liquidRE().isInvestor(_to)) || msg.sender == address(liquidREPointer.liquidRE().rentLogic().rent()));
            }
        }
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(_amount);
        balanceOf[_to] = balanceOf[_to].add(_amount);
        emit Transfer(msg.sender, _to, _amount);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint256 _amount) public returns (bool) {
        if (!anyCanTransfer) {
            if (!investorsCanTransfer) {
                require(liquidREPointer.liquidRE().isProperty(msg.sender) || msg.sender == address(liquidREPointer.liquidRE().rentLogic().rent()));
            } else {
                require(liquidREPointer.liquidRE().isProperty(msg.sender) || (liquidREPointer.liquidRE().isInvestor(msg.sender) && liquidREPointer.liquidRE().isInvestor(_from) && liquidREPointer.liquidRE().isInvestor(_to)) || msg.sender == address(liquidREPointer.liquidRE().rentLogic().rent()));
            }
        }
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_amount);
        balanceOf[_from] = balanceOf[_from].sub(_amount);
        balanceOf[_to] = balanceOf[_to].add(_amount);
        emit Transfer(_from, _to, _amount);
        return true;
    }
    
    function approve(address _spender, uint256 _amount) public returns (bool) {
        // require(_amount == 0 || allowance[msg.sender][_spender] == 0);
        allowance[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }
    
    function transferFromByLogic(address _from, address _to, uint256 _amount, uint8 _propertyVersion) public returns (bool) {
        require(liquidREPointer.liquidRE().isAnyLogic(msg.sender, _propertyVersion));
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_amount);
        balanceOf[_from] = balanceOf[_from].sub(_amount);
        balanceOf[_to] = balanceOf[_to].add(_amount);
        emit Transfer(_from, _to, _amount);
        return true;
    }
}
