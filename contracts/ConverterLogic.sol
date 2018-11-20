pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./LiquidRE.sol";
import "./LiquidProperty.sol";
import "./LRETLogic.sol";
import "./SafeMath.sol";
import "./IERC20Token.sol";
import "./bancor/interfaces/IBancorFormula.sol";
import "./AntiERC20Sink.sol";

contract ConverterLogic is AntiERC20Sink {

    using SafeMath for uint256;

    uint8 public constant version = 0;

    LiquidREPointer public liquidREPointer;

    event Buy(address indexed property, address indexed buyer, uint256 amount, uint256 _return);
    event Sell(address indexed property, address indexed seller, uint256 amount, uint256 _return);
    event DepositDividends(address indexed property, uint256 amount);
    event RequestWithdrawal(address indexed property, uint256 amount);
    event Withdrawal(address indexed property, uint256 amount);
    
    function ConverterLogic(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }

    modifier active() {
        isActive();
        _;
    }

    modifier propertyTrusteeOnly(LiquidProperty _property) {
        require(msg.sender == _property.trustee());
        _;
    }

    modifier validGasPrice() {
        assert(tx.gasprice <= liquidREPointer.liquidRE().bancorGasPriceLimit());
        _;
    }

    modifier investorOnly() {
        require(liquidREPointer.liquidRE().isInvestor(msg.sender));
        _;
    }

    function isActive() internal view {
        require(liquidREPointer.liquidRE().active());
    }

    function getBalance(LiquidProperty _property) public view returns (uint256) {
        uint256 balance = liquidREPointer.liquidRE().stableToken().balanceOf(address(_property));
        uint256 depositBufferStartBlock = _property.depositBufferStartBlock();
        uint256 depositBufferAmount = _property.depositBufferAmount();
        uint256 withdrawalBufferStartBlock = _property.withdrawalBufferStartBlock();
        uint256 withdrawalBufferAmount = _property.withdrawalBufferAmount();
        uint24 blocksToSmoothWithdrawal = liquidREPointer.liquidRE().blocksToSmoothWithdrawal();
        uint24 blocksToSmoothDividend = liquidREPointer.liquidRE().blocksToSmoothDividend();
        if (balance > 1e16) {
            if (block.number < depositBufferStartBlock.add(blocksToSmoothDividend)) {
                // calculate what percentage of the dividend has been buffered in
                uint256 unbufferedDepositAmount = depositBufferAmount.mul(depositBufferStartBlock.add(blocksToSmoothDividend).sub(block.number)).div(blocksToSmoothDividend);
                // make sure balance never goes below 1 without actual balance being that low
                if (balance > unbufferedDepositAmount.add(1e16)) {
                    balance -= unbufferedDepositAmount;
                } else {
                    balance = 1e16;
                }
            }
            if (withdrawalBufferAmount > 0) {
                uint256 bufferedWithdrawalAmount = withdrawalBufferAmount;
                if (block.number < withdrawalBufferStartBlock.add(blocksToSmoothWithdrawal)) {
                    // calculate what percentage of the balance is buffered out so far
                    bufferedWithdrawalAmount = withdrawalBufferAmount.mul(block.number.sub(withdrawalBufferStartBlock)).div(blocksToSmoothWithdrawal);
                }
                if (balance > bufferedWithdrawalAmount.add(1e16)) {
                    balance -= bufferedWithdrawalAmount;
                } else {
                    balance = 1e16;
                }
            }
        }
        return balance;
    }

    // allows trustee to send dividends (as connector tokens) that add to the connector balance without minting and update the virtual balance buffer
    function depositDividends(LiquidProperty _property, uint256 _depositAmount) public active {
        require(_property.status() == LiquidProperty.Status.Trading);
        require(_depositAmount > 0);
        require(msg.sender == _property.trustee() || liquidREPointer.liquidRE().isManager(msg.sender));
        uint256 lretDeposit = _depositAmount.mul(99).div(100);
        uint256 depositBufferStartBlock = _property.depositBufferStartBlock();
        uint24 blocksToSmoothDividend = liquidREPointer.liquidRE().blocksToSmoothDividend();
        if (block.number < depositBufferStartBlock.add(blocksToSmoothDividend)) {
            _property.setDepositBufferAmount(_property.depositBufferAmount().mul(depositBufferStartBlock.add(blocksToSmoothDividend).sub(block.number)).div(blocksToSmoothDividend).add(lretDeposit));
        } else {
            _property.setDepositBufferAmount(lretDeposit);
        }
        _property.setDepositBufferStartBlock(block.number);
        liquidREPointer.liquidRE().rentLogic().updateDividendsBuffer(_depositAmount.sub(lretDeposit), _property.version());
        liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, _property, lretDeposit, _property.version());
        liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, liquidREPointer.liquidRE().rentLogic().rent(), _depositAmount.sub(lretDeposit), _property.version());
        emit DepositDividends(_property, lretDeposit);
    }

    // allows trustee to request an amount to be withdrawn in ~20 to 30 days
    function requestWithdrawal(LiquidProperty _property, uint256 _requestedAmount) public active propertyTrusteeOnly(_property) {
        require(_property.status() == LiquidProperty.Status.Trading);
        // make sure there isn't a current withdrawal being processed by the buffer
        require(_property.withdrawalBufferAmount() == 0);
        _property.setWithdrawalBufferAmount(_requestedAmount);
        _property.setWithdrawalBufferStartBlock(block.number);
        emit RequestWithdrawal(_property, _requestedAmount);
    }

    // allows trustee to withdraw a previously requested amount if it's ready and available in the real balance
    function withdraw(LiquidProperty _property) public active {
        require(_property.status() == LiquidProperty.Status.Trading);
        require(msg.sender == _property.trustee() || liquidREPointer.liquidRE().isManager(msg.sender));
        uint256 withdrawalBufferStartBlock = _property.withdrawalBufferStartBlock();
        uint256 withdrawalBufferAmount = _property.withdrawalBufferAmount();
        require((withdrawalBufferAmount > 0) && (withdrawalBufferAmount < (liquidREPointer.liquidRE().stableToken().balanceOf(address(_property)) - 1)) && (block.number > withdrawalBufferStartBlock.add(liquidREPointer.liquidRE().blocksToSmoothWithdrawal())));
        _property.setWithdrawalBufferAmount(0);
        _property.sendStableToken(msg.sender, withdrawalBufferAmount);
        emit Withdrawal(_property, withdrawalBufferAmount);
    }

    function buy(LiquidProperty _property, uint256 _depositAmount, uint256 _minReturn) public active investorOnly validGasPrice returns (uint256) {
        require(_property.status() == LiquidProperty.Status.Trading);
        if (_property.globalWhitelistEnabled()) {
            require(!_property.localCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(msg.sender)) || _property.isOnLocalWhitelist(msg.sender));
        } else {
            require(_property.isOnLocalWhitelist(msg.sender));
        }
        uint256 amount = getPurchaseReturn(_property, _depositAmount);
        require(amount != 0 && amount >= _minReturn);
        liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, _property, _depositAmount, _property.version());
        liquidREPointer.liquidRE().lretLogic(_property.version()).issue(_property, msg.sender, amount);
        emit Buy(_property, msg.sender, _depositAmount, amount);
        return amount;
    }

    function getPurchaseReturn(LiquidProperty _property, uint256 _depositAmount) public view returns (uint256) {
        uint256 amount = liquidREPointer.liquidRE().bancorFormula().calculatePurchaseReturn(_property.totalSupply(), getBalance(_property), _property.connectorWeight(), _depositAmount);
        return amount.sub(amount.mul(liquidREPointer.liquidRE().buyFee()).div(1000000));
    }

    function sell(LiquidProperty _property, uint256 _sellAmount, uint256 _minReturn) public active validGasPrice returns (uint256) {
        require(_property.status() == LiquidProperty.Status.Trading || _property.status() == LiquidProperty.Status.Dissolved);
        require(_sellAmount <= _property.balanceOf(msg.sender));
        uint256 connectorBalance = getBalance(_property);
        uint256 amount = getSaleReturn(_property, _sellAmount, connectorBalance);
        require(amount != 0 && amount >= _minReturn);
        assert(amount < connectorBalance || (amount == connectorBalance && _sellAmount == _property.totalSupply()));
        liquidREPointer.liquidRE().lretLogic(_property.version()).destroy(_property, msg.sender, _sellAmount);
        emit Sell(_property, msg.sender, _sellAmount, amount);
        _property.sendStableToken(msg.sender, amount);
        return amount;
    }

    function getSaleReturn(LiquidProperty _property, uint256 _sellAmount, uint256 _connectorBalance) internal view returns (uint256) {
        uint256 amount = liquidREPointer.liquidRE().bancorFormula().calculateSaleReturn(_property.totalSupply(), _connectorBalance, _property.connectorWeight(), _sellAmount);
        return amount.sub(amount.mul(liquidREPointer.liquidRE().sellFee()).div(1000000));
    }

    function getSaleReturn(LiquidProperty _property, uint256 _sellAmount) public view returns (uint256) {
        return getSaleReturn(_property, _sellAmount, getBalance(_property));
    }
}
