pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./LiquidRE.sol";
import "./LiquidProperty.sol";
import "./LRETLogic.sol";
import "./SafeMath.sol";
import "./IERC20Token.sol";
import "./AntiERC20Sink.sol";

contract IREOLogic is AntiERC20Sink {

    using SafeMath for uint256;
    
    uint8 public constant version = 0;

    LiquidREPointer public liquidREPointer;

    event Contribution(address indexed property, address indexed contributor, uint256 amount);
    event NewTrusteeBid(address indexed property, address trustee, uint16 basis);
    event RemovedTrusteeBid(address indexed property, address trustee);
    event ChosenTrusteeBid(address indexed property, address trustee, uint16 basis);
    event MinGoalReached(address indexed property);
    event MaxGoalReached(address indexed property);
    event IREOFailed(address indexed property);
    event IREOStatusChange(address indexed property, LiquidProperty.Status status);
    event TrustDissolved(address indexed property);

    function IREOLogic(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }

    modifier active() {
        isActive();
        _;
    }

    modifier investorOnly() {
        require(liquidREPointer.liquidRE().isInvestor(msg.sender));
        _;
    }

    modifier trusteeOnly(address _trustee) {
        require(liquidREPointer.liquidRE().isTrustee(_trustee));
        _;
    }

    modifier sellerOnly() {
        require(liquidREPointer.liquidRE().isSeller(msg.sender));
        _;
    }

    function isActive() internal view {
        require(liquidREPointer.liquidRE().active());
    }

    function sellerCancelIREO(LiquidProperty _property) public active {
        require(msg.sender == _property.seller());
        require(_property.status() == LiquidProperty.Status.Bidding);
        _property.setStatus(LiquidProperty.Status.CancelledBySeller);
        emit IREOFailed(_property);
        emit IREOStatusChange(_property, LiquidProperty.Status.CancelledBySeller);
    }

    function trusteeCancelIREO(LiquidProperty _property) public active trusteeOnly(msg.sender) {
        require(msg.sender == _property.trustee());
        require(_property.status() == LiquidProperty.Status.Funding);
        _property.setStatus(LiquidProperty.Status.CancelledByTrustee);
        emit IREOFailed(_property);
        emit IREOStatusChange(_property, LiquidProperty.Status.CancelledByTrustee);
    }

    function dissolveTrust(LiquidProperty _property, uint256 _transferAmount) public active trusteeOnly(msg.sender) {
        require(msg.sender == _property.trustee());
        LiquidProperty.Status status = _property.status();
        if (status == LiquidProperty.Status.Withdrawn) {
            liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, _property, _property.amountRaised().mul(9).div(10), _property.version());
        } else if (status == LiquidProperty.Status.Frozen) {
            uint256 lretDeposit = _transferAmount.mul(99).div(100);
            liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, _property, lretDeposit, _property.version());
            liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, liquidREPointer.liquidRE().rentLogic().rent(), _transferAmount.sub(lretDeposit), _property.version());
            liquidREPointer.liquidRE().rentLogic().updateDividendsBuffer(_transferAmount.sub(lretDeposit), _property.version());
        } else {
            revert();
        }
        _property.setWithdrawalBufferStartBlock(0);
        _property.setDepositBufferStartBlock(0);
        _property.setConnectorWeight(1000000);
        _property.setStatus(LiquidProperty.Status.Dissolved);
        emit TrustDissolved(_property);
        emit IREOStatusChange(_property, LiquidProperty.Status.Dissolved);
    }
    
    function bid(LiquidProperty _property, uint16 _basis) public active trusteeOnly(msg.sender) {
        require(_property.status() == LiquidProperty.Status.Bidding);
        require(_basis < 10000);
        _property.addBid(msg.sender, _basis);
        emit NewTrusteeBid(_property, msg.sender, _basis);
    }

    function selectBid(LiquidProperty _property, address _trustee) public active sellerOnly trusteeOnly(_trustee) {
        require(msg.sender == _property.seller());
        require(_property.status() == LiquidProperty.Status.Bidding);
        bool bidExists = false;
        uint16 basis;
        (bidExists,, basis) = _property.bids(_trustee);
        require(bidExists);
        _property.setTrustee(_trustee);
        _property.setTrusteeFee(basis);
        emit ChosenTrusteeBid(_property, _trustee, basis);
    }

    function approveIREO(LiquidProperty _property, uint256 _minFundingGoal, uint256 _maxFundingGoal, uint40 _startTime, uint40 _endTime, bool _globalWhitelistEnabled) public active trusteeOnly(msg.sender) {
        require(msg.sender == _property.trustee());
        require(_property.status() == LiquidProperty.Status.Bidding);
        require(_maxFundingGoal >= _minFundingGoal && _startTime > now && _endTime > _startTime);
        _property.setMinFundingGoal(_minFundingGoal);
        _property.setMaxFundingGoal(_maxFundingGoal);
        _property.setStartTime(_startTime);
        _property.setEndTime(_endTime);
        _property.setGlobalWhitelistEnabled(_globalWhitelistEnabled);
        _property.setStatus(LiquidProperty.Status.Funding);
        emit IREOStatusChange(_property, LiquidProperty.Status.Funding);
    }

    function contribute(LiquidProperty _property, uint256 _amount) public active investorOnly returns (uint256) {
        require(_property.status() == LiquidProperty.Status.Funding);
        require(_property.endTime() > now && _property.startTime() < now);
        uint256 amountRaised = _property.amountRaised();
        uint256 maxFundingGoal = _property.maxFundingGoal();
        require(amountRaised < maxFundingGoal);
        require(_amount > 0);
        if (_property.globalWhitelistEnabled()) {
            require(!_property.localCountryBlacklist(liquidREPointer.liquidRE().getCountryCode(msg.sender)));
        } else {
            require(_property.isOnLocalWhitelist(msg.sender));
        }
        uint256 amount = _amount;
        if (amountRaised.add(amount) > maxFundingGoal) {
            amount = maxFundingGoal.sub(amountRaised);
        }
        if (_property.contributions(msg.sender) == 0 ) {
            _property.setContributorCount(_property.contributorCount() + 1);
        }
        _property.addContributions(msg.sender, amount);
        _property.addAmountRaised(amount);
        liquidREPointer.liquidRE().lretLogic(_property.version()).issue(_property, msg.sender, amount);
        if (_property.amountRaised() >= _property.maxFundingGoal()) {
            emit MaxGoalReached(_property);
        }
        if (_property.amountRaised() >= _property.minFundingGoal() && amountRaised < _property.minFundingGoal()) {
            emit MinGoalReached(_property);
        }
        liquidREPointer.liquidRE().stableToken().transferFromByLogic(msg.sender, _property, amount, _property.version());
        emit Contribution(_property, msg.sender, amount);
        return amount;
    }

    function withdrawContribution(LiquidProperty _property) public active {
        uint256 contribution = _property.contributions(msg.sender);
        require(contribution > 0);
        LiquidProperty.Status status = _property.status();
        if (status == LiquidProperty.Status.Funding) {
            require(_property.endTime() < now);
            _property.setStatus(LiquidProperty.Status.Failed);
            emit IREOFailed(_property);
            emit IREOStatusChange(_property, LiquidProperty.Status.Failed);
        } else {
            require(status == LiquidProperty.Status.Failed || status == LiquidProperty.Status.CancelledBySeller || status == LiquidProperty.Status.CancelledByTrustee);
        }
        liquidREPointer.liquidRE().lretLogic(_property.version()).destroy(_property, msg.sender, contribution);
        _property.setContributions(msg.sender, 0);
        _property.addAmountWithdrawn(contribution);
        _property.sendStableToken(msg.sender, contribution);
    }

    function withdrawToTrustee(LiquidProperty _property) public active trusteeOnly(msg.sender) {
        require(_property.status() == LiquidProperty.Status.Funding);
        require(msg.sender == _property.trustee());
        if (_property.amountRaised() < _property.maxFundingGoal()) {
            require(_property.amountRaised() >= _property.minFundingGoal() && _property.endTime() < now);
        }
        _property.setStatus(LiquidProperty.Status.Withdrawn);
        emit IREOStatusChange(_property, LiquidProperty.Status.Withdrawn);
        _property.sendStableToken(msg.sender, _property.amountRaised().mul(9).div(10));
    }
}
