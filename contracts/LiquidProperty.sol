pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./LiquidRE.sol";
import "./LRETLogic.sol";
import "./IERC20Token.sol";
import "./SafeMath.sol";
import "./AntiERC20Sink.sol";

contract LiquidProperty is AntiERC20Sink {

    using SafeMath for uint256;

    uint8 public constant version = 0; // version of the property contract in case we change things later, the logic contracts need a way of knowing what version it interacts with

    LiquidREPointer public liquidREPointer;

    enum Status {
        Bidding, // trustees are bidding on it. it only proceeds to funding when the seller chooses a trustee, and the trustee accepts and sets min/max/start/end/etc
        Funding, // if funding AND now is between start and end, investors can contribute
        Withdrawn, // trustee withdrew
        Trading, // trustee enabled trading after withdrawal
        Frozen, // trustee has frozen trading
        Failed,
        CancelledBySeller, // seller that created it decided to cancel it before choosing a trustee
        CancelledByTrustee, // trustee decided to cancel it
        Dissolved // trustee dissolved trust
    }
    Status public status;
    address public factory; // points to the factory that created this property contract, never changes. so we can look up factory version if needed

    string public name; // ERC20 token name = street address
    string public constant symbol = "LRET";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;
    address[] public beneficiaries; // every investor that ever trades/owns/buys/sells an LRET is on this list, never removed
    mapping (address => bool) public beneficiaryExists; // mapping that says if they're already in the array so we don't add duplicates
    
    uint256 public minFundingGoal;
    uint256 public maxFundingGoal;
    uint40 public startTime;
    uint40 public endTime;
    uint256 public amountRaised;
    uint256 public amountWithdrawn;

    address public seller;
    address public trustee; // only set after it is finalized
    uint16 public trusteeFee; // in basis points
    uint256 public contributorCount;
    mapping(address => uint256) public contributions;
    struct Bid {
        bool exists;
        uint256 arrayIndex;
        uint16 basis;
    }
    address[] public bidders;
    mapping(address => Bid) public bids;
    uint256 public bidCount;

    // voting logic related storage. included for future upgrades
    // struct Proposal {
    //     string description;
    //     uint40 startTime;
    //     uint40 endTime;
    //     uint256 voteCount;
    //     Vote[] votes;
    //     mapping (address => bool) voted;
    // }
    // struct Vote {
    //     bool yay;
    //     uint256 weight;
    //     address voter;
    // }
    // Proposal[] public proposals;

    // storage for restricting future trustee god mode functions with a time delay
    uint40 public trusteeAdminActionRequestTime;
    uint8 public trusteeAdminAction;

    uint256 public rollingPrice;
    uint40 public lastRollingPriceUpdate;

    uint256 public depositBufferStartBlock;
    uint256 public depositBufferAmount;
    uint256 public withdrawalBufferStartBlock;
    uint256 public withdrawalBufferAmount;
    uint32 public connectorWeight = 100000;

    uint40 public created;

    struct ExistsAndArrayIndex {
        bool exists;
        uint256 arrayIndex;
    }
    mapping(address => ExistsAndArrayIndex) public localWhitelistInfo;
    address[] public localWhitelist;

    mapping(uint16 => bool) public localCountryBlacklist;

    bool public globalWhitelistEnabled;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function LiquidProperty(
        uint256 _minFundingGoal,
        uint256 _maxFundingGoal,
        uint40 _startTime,
        uint40 _endTime,
        string _streetAddress,
        address _seller,
        bool _globalWhitelistEnabled,
        LiquidREPointer _liquidREPointer
    ) 
        public
    {
        minFundingGoal = _minFundingGoal;
        maxFundingGoal = _maxFundingGoal;
        startTime = _startTime;
        endTime = _endTime;
        name = _streetAddress;
        seller = _seller;
        globalWhitelistEnabled = _globalWhitelistEnabled;
        liquidREPointer = _liquidREPointer;
        factory = msg.sender;
        created = uint40(now);
    }

    modifier anyLogicOnly() {
        isAnyLogicOnly();
        _;
    }

    function isAnyLogicOnly() internal view {
        require(liquidREPointer.liquidRE().isAnyLogic(msg.sender, version));
    }

    // getters for arrays
    function getBeneficiaries() public view returns (address[]) {
        return beneficiaries;
    }

    function getBidders() public view returns (address[]) {
        return bidders;
    }

    function getLocalWhitelist() public view returns (address[]) {
        return localWhitelist;
    }

    function isOnLocalWhitelist(address _investor) public view returns (bool) {
        return localWhitelistInfo[_investor].exists;
    }

    // setters
    function setTrusteeAdminActionRequestTime(uint40 _trusteeAdminActionRequestTime) public anyLogicOnly {
        trusteeAdminActionRequestTime = _trusteeAdminActionRequestTime;
    }

    function setTrusteeAdminAction(uint8 _trusteeAdminAction) public anyLogicOnly {
        trusteeAdminAction = _trusteeAdminAction;
    }

    function setGlobalWhitelistEnabled(bool _globalWhitelistEnabled) public anyLogicOnly {
        globalWhitelistEnabled = _globalWhitelistEnabled;
    }

    function setLocalCountryBlacklist(uint16 _countryCode, bool _blocked) public anyLogicOnly {
        localCountryBlacklist[_countryCode] = _blocked;
    }

    function addToWhitelist(address _investor) public anyLogicOnly {
        require(!localWhitelistInfo[_investor].exists);
        localWhitelistInfo[_investor] = ExistsAndArrayIndex({exists: true, arrayIndex: localWhitelist.length});
        localWhitelist.push(_investor);
    }

    function deleteFromWhiteList(address _investor) public anyLogicOnly {
        require(localWhitelistInfo[_investor].exists);
        delete localWhitelist[localWhitelistInfo[_investor].arrayIndex];
        delete localWhitelistInfo[_investor];
    }

    function setRollingPrice(uint256 _rollingPrice) public anyLogicOnly {
        rollingPrice = _rollingPrice;
    }

    function setLastRollingPriceUpdate(uint40 _lastRollingPriceUpdate) public anyLogicOnly {
        lastRollingPriceUpdate = _lastRollingPriceUpdate;
    }

    function setDepositBufferStartBlock(uint256 _depositBufferStartBlock) public anyLogicOnly {
        depositBufferStartBlock = _depositBufferStartBlock;
    }

    function setDepositBufferAmount(uint256 _depositBufferAmount) public anyLogicOnly {
        depositBufferAmount = _depositBufferAmount;
    }

    function setWithdrawalBufferStartBlock(uint256 _withdrawalBufferStartBlock) public anyLogicOnly {
        withdrawalBufferStartBlock = _withdrawalBufferStartBlock;
    }

    function setWithdrawalBufferAmount(uint256 _withdrawalBufferAmount) public anyLogicOnly {
        withdrawalBufferAmount = _withdrawalBufferAmount;
    }

    function setConnectorWeight(uint32 _connectorWeight) public anyLogicOnly {
        connectorWeight = _connectorWeight;
    }

    function addBeneficiary(address _beneficiary) public anyLogicOnly {
        if (!beneficiaryExists[_beneficiary]) {
            beneficiaries.push(_beneficiary);
            beneficiaryExists[_beneficiary] = true;
        }
    }

    function setStatus(Status _status) public anyLogicOnly {
        status = _status;
    }

    function setName(string _name) public anyLogicOnly {
        name = _name;
    }

    function setMinFundingGoal(uint256 _minFundingGoal) public anyLogicOnly {
        minFundingGoal = _minFundingGoal;
    }

    function setMaxFundingGoal(uint256 _maxFundingGoal) public anyLogicOnly {
        maxFundingGoal = _maxFundingGoal;
    }

    function setStartTime(uint40 _startTime) public anyLogicOnly {
        startTime = _startTime;
    }

    function setEndTime(uint40 _endTime) public anyLogicOnly {
        endTime = _endTime;
    }

    function setContributions(address _contributor, uint256 _amount) public anyLogicOnly {
        contributions[_contributor] = _amount;
    }

    function addContributions(address _contributor, uint256 _amount) public anyLogicOnly {
        contributions[_contributor] = contributions[_contributor].add(_amount);
    }

    function setContributorCount(uint256 _count) public anyLogicOnly {
        contributorCount = _count;
    }

    function setAmountRaised(uint256 _amount) public anyLogicOnly {
        amountRaised = _amount;
    }

    function addAmountRaised(uint256 _amount) public anyLogicOnly {
        amountRaised = amountRaised.add(_amount);
    }

    function addAmountWithdrawn(uint256 _amount) public anyLogicOnly {
        amountWithdrawn = amountWithdrawn.add(_amount);
    }

    function sendStableToken(address _to, uint256 _amount) public anyLogicOnly {
        assert(liquidREPointer.liquidRE().stableToken().transfer(_to, _amount));
    }

    function receiveStableToken(address _from, uint256 _amount) public anyLogicOnly {
        assert(liquidREPointer.liquidRE().stableToken().transferFrom(_from, this, _amount));
    }

    function approveStableToken(address _to, uint256 _amount) public anyLogicOnly {
        assert(liquidREPointer.liquidRE().stableToken().approve(_to, _amount));
    }

    // function addTotalSupply(uint256 _amount) public anyLogicOnly {
    //     totalSupply = totalSupply.add(_amount);
    // }

    // function subTotalSupply(uint256 _amount) public anyLogicOnly {
    //     totalSupply = totalSupply.sub(_amount);
    // }

    // function setBalanceOf(address _address, uint256 _amount) public anyLogicOnly {
    //     balanceOf[_address] = _amount;
    // }

    function addBalanceOf(address _address, uint256 _amount) public anyLogicOnly {
        balanceOf[_address] = balanceOf[_address].add(_amount);
        totalSupply = totalSupply.add(_amount);
    }

    function subBalanceOf(address _address, uint256 _amount) public anyLogicOnly {
        balanceOf[_address] = balanceOf[_address].sub(_amount);
        totalSupply = totalSupply.sub(_amount);
    }

    function setAllowance(address _from, address _to, uint256 _amount) public anyLogicOnly {
        allowance[_from][_to] = _amount;
    }

    function addAllowance(address _from, address _to, uint256 _amount) public anyLogicOnly {
        allowance[_from][_to] = allowance[_from][_to].add(_amount);
    }

    function subAllowance(address _from, address _to, uint256 _amount) public anyLogicOnly {
        allowance[_from][_to] = allowance[_from][_to].sub(_amount);
    }

    function emitTransfer(address _from, address _to, uint256 _amount) public anyLogicOnly {
        emit Transfer(_from, _to, _amount);
    }

    function emitApproval(address _owner, address _spender, uint256 _amount) public anyLogicOnly {
        emit Approval(_owner, _spender, _amount);
    }

    // ERC20 functions called by wallet owner. this just calls on lret logic. this allows the property to be ERC20 compliant and work with wallets, but still gives full control to lret logic
    function transfer(address _to, uint256 _amount) public returns (bool) {
        liquidREPointer.liquidRE().lretLogic(version).transferByProperty(_to, _amount, msg.sender);
        return true;
    }
  
    function transferFrom(address _from, address _to, uint256 _amount) public returns (bool) {
        liquidREPointer.liquidRE().lretLogic(version).transferFromByProperty(_from, _to, _amount, msg.sender);
        return true;
    }

    function approve(address _spender, uint256 _amount) public returns (bool) {
        liquidREPointer.liquidRE().lretLogic(version).approveByProperty(_spender, _amount, msg.sender);
        return true;
    }

    // bid functions
    function addBid(address _trustee, uint16 _basis) public anyLogicOnly {
        if (!bids[_trustee].exists) {
            bids[_trustee] = Bid({exists: true, basis: _basis, arrayIndex: bidders.length});
            bidders.push(_trustee);
            bidCount++;
        } else {
            updateBid(_trustee, _basis);
        }
    }

    function deleteBid(address _trustee) public anyLogicOnly {
        require(bids[_trustee].exists);
        delete bidders[bids[_trustee].arrayIndex];
        delete bids[_trustee];
        bidCount--;
    }

    function updateBid(address _trustee, uint16 _basis) public anyLogicOnly {
        require(bids[_trustee].exists);
        bids[_trustee].basis = _basis;
    }

    function setTrustee(address _trustee) public anyLogicOnly {
        trustee = _trustee;
    }

    function setTrusteeFee(uint16 _trusteeFee) public anyLogicOnly {
        trusteeFee = _trusteeFee;
    }
}
