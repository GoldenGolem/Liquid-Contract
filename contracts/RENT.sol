pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./SafeMath.sol";
import "./ConverterLogic.sol";
import "./IERC20Token.sol";
import "./AntiERC20Sink.sol";

contract RENT is AntiERC20Sink {

    using SafeMath for uint256;

    LiquidREPointer public liquidREPointer;

    bool public anyCanTransfer;
    bool public investorsCanTransfer;
    bool public conversionsEnabled;
    bool public initialized;

    string public constant name = "LiquidRE Network Token";
    string public constant symbol = "RENT";
    uint8 public constant decimals = 18;

    uint256 public totalSupply = 0;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    uint256 public rollingPrice;
    uint40 public lastRollingPriceUpdate;

    uint256 public depositBufferStartBlock;
    uint256 public depositBufferAmount;
    uint32 public connectorWeight = 50000;
    uint24 public blocksToSmoothDividend = 175320;

    // fees in ppm
    uint256 public buyFee;
    uint256 public sellFee;

    mapping (uint16 => bool) public localCountryBlacklist;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function RENT(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }

    modifier rentLogicOnly() {
        require(msg.sender == address(liquidREPointer.liquidRE().rentLogic()));
        _;
    }

    modifier managementOnly() {
        require(liquidREPointer.liquidRE().isManager(msg.sender));
        _;
    }

    function setBuyFee(uint32 _buyFee) public managementOnly {
        buyFee = _buyFee;
    }

    function setSellFee(uint32 _sellFee) public managementOnly {
        sellFee = _sellFee;
    }

    function setBlocksToSmoothDividend(uint24 _blocksToSmoothDividend) public rentLogicOnly {
        blocksToSmoothDividend = _blocksToSmoothDividend;
    }

    function setDepositBufferStartBlock(uint256 _depositBufferStartBlock) public rentLogicOnly {
        depositBufferStartBlock = _depositBufferStartBlock;
    }

    function setDepositBufferAmount(uint256 _depositBufferAmount) public rentLogicOnly {
        depositBufferAmount = _depositBufferAmount;
    }

    function setConnectorWeight(uint32 _connectorWeight) public rentLogicOnly {
        connectorWeight = _connectorWeight;
    }

    function setRollingPrice(uint256 _rollingPrice) public rentLogicOnly {
        rollingPrice = _rollingPrice;
    }

    function setLastRollingPriceUpdate(uint40 _lastRollingPriceUpdate) public rentLogicOnly {
        lastRollingPriceUpdate = _lastRollingPriceUpdate;
    }

    function setLocalCountryBlacklist(uint16 _countryCode, bool _blocked) public rentLogicOnly {
        localCountryBlacklist[_countryCode] = _blocked;
    }

    function setAnyCanTransfer(bool _anyCanTransfer) public rentLogicOnly {
        anyCanTransfer = _anyCanTransfer;
    }

    function setInvestorsCanTransfer(bool _investorsCanTransfer) public rentLogicOnly {
        investorsCanTransfer = _investorsCanTransfer;
    }

    function setConversionsEnabled(bool _conversionsEnabled) public rentLogicOnly {
        conversionsEnabled = _conversionsEnabled;
    }

    function initialize() public rentLogicOnly {
        initialized = true;
    }

    // function setTotalSupply(uint256 _supply) public rentLogicOnly {
    //     totalSupply = _supply;
    // }

    // function addTotalSupply(uint256 _amount) public rentLogicOnly {
    //     totalSupply = totalSupply.add(_amount);
    // }

    // function subTotalSupply(uint256 _amount) public rentLogicOnly {
    //     totalSupply = totalSupply.sub(_amount);
    // }

    // function setBalanceOf(address _address, uint256 _amount) public rentLogicOnly {
    //     balanceOf[_address] = _amount;
    // }

    function addBalanceOf(address _address, uint256 _amount) public rentLogicOnly {
        balanceOf[_address] = balanceOf[_address].add(_amount);
        totalSupply = totalSupply.add(_amount);
    }

    function subBalanceOf(address _address, uint256 _amount) public rentLogicOnly {
        balanceOf[_address] = balanceOf[_address].sub(_amount);
        totalSupply = totalSupply.sub(_amount);
    }

    function setAllowance(address _from, address _to, uint256 _amount) public rentLogicOnly {
        allowance[_from][_to] = _amount;
    }

    function addAllowance(address _from, address _to, uint256 _amount) public rentLogicOnly {
        allowance[_from][_to] = allowance[_from][_to].add(_amount);
    }

    function subAllowance(address _from, address _to, uint256 _amount) public rentLogicOnly {
        allowance[_from][_to] = allowance[_from][_to].sub(_amount);
    }

    function emitTransfer(address _from, address _to, uint256 _amount) public rentLogicOnly {
        emit Transfer(_from, _to, _amount);
    }

    function emitApproval(address _owner, address _spender, uint256 _amount) public rentLogicOnly {
        emit Approval(_owner, _spender, _amount);
    }

    // ERC20 functions called by wallet owner. this just calls on lret logic. this allows the property to be ERC20 compliant and work with wallets, but still gives full control to lret logic
    function transfer(address _to, uint256 _amount) public returns (bool) {
        liquidREPointer.liquidRE().rentLogic().transferByRENT(_to, _amount, msg.sender);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _amount) public returns (bool) {
        liquidREPointer.liquidRE().rentLogic().transferFromByRENT(_from, _to, _amount, msg.sender);
        return true;
    }

    function approve(address _spender, uint256 _amount) public returns (bool) {
        liquidREPointer.liquidRE().rentLogic().approveByRENT(_spender, _amount, msg.sender);
        return true;
    }

    function sendStableToken(address _to, uint256 _amount) public rentLogicOnly {
        assert(liquidREPointer.liquidRE().stableToken().transfer(_to, _amount));
    }

    function receiveStableToken(address _from, uint256 _amount) public rentLogicOnly {
        assert(liquidREPointer.liquidRE().stableToken().transferFrom(_from, this, _amount));
    }

    function approveStableToken(address _to, uint256 _amount) public rentLogicOnly {
        assert(liquidREPointer.liquidRE().stableToken().approve(_to, _amount));
    }

    function isOnLocalCountryBlacklist(uint16 _countryCode) public view returns (bool) {
        return localCountryBlacklist[_countryCode];
    }
}
