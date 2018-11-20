pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./SafeMath.sol";
import "./ConverterLogic.sol";
import "./IERC20Token.sol";
import "./RENT.sol";
import "./AntiERC20Sink.sol";

contract RENTLogic is AntiERC20Sink {

    using SafeMath for uint256;

    LiquidREPointer public liquidREPointer;

    RENT public rent;
    
    event Buy(address indexed buyer, uint256 amount, uint256 _return);
    event Sell(address indexed seller, uint256 amount, uint256 _return);
    event TransferRestrictionsChange(bool anyCanTransfer, bool investorsCanTransfer, bool conversionsEnabled);

    function RENTLogic(LiquidREPointer _liquidREPointer, RENT _rent) public {
        liquidREPointer = _liquidREPointer;
        rent = _rent;
    }

    modifier validGasPrice() {
        assert(tx.gasprice <= liquidREPointer.liquidRE().bancorGasPriceLimit());
        _;
    }

    modifier managementOnly() {
        isManager();
        _;
    }

    modifier active() {
        isActive();
        _;
    }

    modifier investorOnly() {
        require(liquidREPointer.liquidRE().isInvestor(msg.sender));
        _;
    }

    modifier enabled() {
        require(rent.conversionsEnabled());
        _;
    }

    function isActive() internal view {
        require(liquidREPointer.liquidRE().active());
    }

    function isManager() internal view {
        require(liquidREPointer.liquidRE().isManager(msg.sender));
    }

    function initializeRENT(uint256 _stableTokenAmount, uint256 _rentAmount, uint32 _connectorWeight) public managementOnly {
        require(!rent.initialized());
        liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, rent, _stableTokenAmount, 0);
        issue(msg.sender, _rentAmount);
        rent.setConnectorWeight(_connectorWeight);
        rent.initialize();
        rent.setConversionsEnabled(true);
    }

    function changeTransferRestrictions(bool _anyCanTransfer, bool _investorsCanTransfer, bool _conversionsEnabled) public managementOnly {
        rent.setAnyCanTransfer(_anyCanTransfer);
        rent.setInvestorsCanTransfer(_investorsCanTransfer);
        rent.setConversionsEnabled(_conversionsEnabled);
        emit TransferRestrictionsChange(_anyCanTransfer, _investorsCanTransfer, _conversionsEnabled);
    }

    function setLocalCountryBlacklist(uint16 _countryCode, bool _blocked) public managementOnly {
        rent.setLocalCountryBlacklist(_countryCode, _blocked);
    }

    function changeConnectorWeight(uint32 _connectorWeight) public managementOnly {
        rent.setConnectorWeight(_connectorWeight);
    }

    function changeBlocksToSmoothDividend(uint24 _blocksToSmoothDividend) public managementOnly {
        rent.setBlocksToSmoothDividend(_blocksToSmoothDividend);
    }

    function issue(address _to, uint256 _amount) internal {
        // rent.addTotalSupply(_amount);
        rent.addBalanceOf(_to, _amount);
        rent.emitTransfer(this, _to, _amount);
    }

    function destroy(address _from, uint256 _amount) internal {
        rent.subBalanceOf(_from, _amount);
        // rent.subTotalSupply(_amount);
        rent.emitTransfer(_from, this, _amount);
    }

    function transfer(address _to, uint256 _amount) public active returns (bool) {
        if (!rent.anyCanTransfer()) {
            require(rent.investorsCanTransfer() && liquidREPointer.liquidRE().isInvestor(msg.sender) && liquidREPointer.liquidRE().isInvestor(_to) && !rent.isOnLocalCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(msg.sender)) && !rent.isOnLocalCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(_to)));
        }
        rent.subBalanceOf(msg.sender, _amount);
        rent.addBalanceOf(_to, _amount);
        rent.emitTransfer(msg.sender, _to, _amount);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint256 _amount) public active returns (bool) {
        if (!rent.anyCanTransfer()) {
            require(rent.investorsCanTransfer() && liquidREPointer.liquidRE().isInvestor(msg.sender) && liquidREPointer.liquidRE().isInvestor(_to) && liquidREPointer.liquidRE().isInvestor(_from) && !rent.isOnLocalCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(msg.sender)) && !rent.isOnLocalCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(_to)) && !rent.isOnLocalCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(_from)));
        }
        rent.subAllowance(_from, msg.sender, _amount);
        rent.subBalanceOf(_from, _amount);
        rent.addBalanceOf(_to, _amount);
        rent.emitTransfer(_from, _to, _amount);
        return true;
    }
    
    function approve(address _spender, uint256 _amount) public active returns (bool) {
        // require(_amount == 0 || rent.allowance(msg.sender,_spender) == 0);
        rent.setAllowance(msg.sender, _spender, _amount);
        rent.emitApproval(msg.sender, _spender, _amount);
        return true;
    }

    // TODO:
    function getBalance() public view returns (uint256) {
        if (block.number < rent.depositBufferStartBlock().add(rent.blocksToSmoothDividend())) {
            // calculate what percentage of the dividend has been buffered in
            return liquidREPointer.liquidRE().stableToken().balanceOf(address(rent)).sub(rent.depositBufferAmount().mul(rent.depositBufferStartBlock().add(rent.blocksToSmoothDividend()).sub(block.number)).div(rent.blocksToSmoothDividend()));
        } else {
            return liquidREPointer.liquidRE().stableToken().balanceOf(address(rent));
        }
    }

    function updateDividendsBuffer(uint256 _depositAmount, uint8 _propertyVersion) public active {
        require(liquidREPointer.liquidRE().isConverterLogic(ConverterLogic(msg.sender), _propertyVersion));
        // if block number < depositBufferStartBlock + blocksToSmoothDividend
        // then we are still buffering out a previous deposit
        if (block.number < rent.depositBufferStartBlock().add(rent.blocksToSmoothDividend())) {
            // calculate the remaining unbuffered amount and add the new deposit amount
            // depositBufferAmount = (depositBufferAmount * (depositBufferStartBlock + blocksToSmoothDividend - block number) / blocksToSmoothDividend) + deposit amount
            // a = (amount * (start+175000-current) / 175000 + deposit
            // blocks remaining in buffer / blocks to smooth = percent of buffer pending
            // buffer amount * percent of buffer pending = amount not buffered in yet
            // new buffer amount = amount not buffered in yet + new deposit
            rent.setDepositBufferAmount(rent.depositBufferAmount().mul(rent.depositBufferStartBlock().add(rent.blocksToSmoothDividend()).sub(block.number)).div(rent.blocksToSmoothDividend()).add(_depositAmount));
        } else {
            rent.setDepositBufferAmount(_depositAmount);
        }
        // reset the start of the buffer to now
        rent.setDepositBufferStartBlock(block.number);
    }

    function buy(uint256 _depositAmount, uint256 _minReturn) public active enabled investorOnly validGasPrice returns (uint256) {
        require(!rent.isOnLocalCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(msg.sender)));
        uint256 amount = getPurchaseReturn(_depositAmount);
        require(amount != 0 && amount >= _minReturn);
        assert(liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, rent, _depositAmount, 0));
        issue(msg.sender, amount);
        emit Buy(msg.sender, _depositAmount, amount);
        return amount;
    }

    function getPurchaseReturn(uint256 _depositAmount) public view returns (uint256) {
        uint256 amount = liquidREPointer.liquidRE().bancorFormula().calculatePurchaseReturn(rent.totalSupply(), getBalance(), rent.connectorWeight(), _depositAmount);
        return amount.sub(amount.mul(rent.buyFee()).div(1000000));
    }

    function sell(uint256 _sellAmount, uint256 _minReturn) public active enabled validGasPrice returns (uint256) {
        require(_sellAmount <= rent.balanceOf(msg.sender));
        uint256 connectorBalance = getBalance();
        uint256 amount = getSaleReturn(_sellAmount, connectorBalance);
        require(amount != 0 && amount >= _minReturn);
        assert(amount < connectorBalance || (amount == connectorBalance && _sellAmount == rent.totalSupply()));
        destroy(msg.sender, _sellAmount);
        rent.sendStableToken(msg.sender, amount);
        emit Sell(msg.sender, _sellAmount, amount);
        return amount;
    }

    function getSaleReturn(uint256 _sellAmount, uint256 _connectorBalance) internal view returns (uint256) {
        uint256 amount = liquidREPointer.liquidRE().bancorFormula().calculateSaleReturn(rent.totalSupply(), _connectorBalance, rent.connectorWeight(), _sellAmount);
        return amount.sub(amount.mul(rent.sellFee()).div(1000000));
    }

    function getSaleReturn(uint256 _sellAmount) public view returns (uint256) {
        return getSaleReturn(_sellAmount, getBalance());
    }

    function transferByRENT(address _to, uint256 _amount, address _sender) public {
        revert();
    }

    function transferFromByRENT(address _from, address _to, uint256 _amount, address _sender) public {
        revert();
    }

    function approveByRENT(address _spender, uint256 _amount, address _sender) public {
        require(msg.sender == address(rent));
        // require(msg.sender == address(rent) && (_amount == 0 || rent.allowance(_sender,_spender) == 0));
        rent.setAllowance(_sender, _spender, _amount);
        rent.emitApproval(_sender, _spender, _amount);
    }
}
