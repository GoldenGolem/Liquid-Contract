pragma solidity ^0.4.21;

import "./IERC20Token.sol";
import "./IREOLogic.sol";
import "./LRETLogic.sol";
import "./ConverterLogic.sol";
import "./VotingLogic.sol";
import "./LiquidFactory.sol";
import "./RENT.sol";
import "./RENTLogic.sol";
import "./TPEG.sol";
import "./bancor/interfaces/IBancorFormula.sol";

contract LiquidRE {

    uint8 public constant version = 0;
    
    // struct that stores whether an address is in an array and what it's index is
    // this allows an array of addresses and a mapping of address to storage variables
    // and setters for add and delete elements update both at once
    struct ExistsAndArrayIndex {
        bool exists;
        uint256 arrayIndex;
    }
    // management addresses
    address[] public administrators;
    mapping(address => ExistsAndArrayIndex) public administratorInfo;
    address[] public managers;
    mapping(address => ExistsAndArrayIndex) public managerInfo;
    address[] public verifiers;
    mapping(address => ExistsAndArrayIndex) public verifierInfo;

    bool public active = true;
    // 60*60*24*365.25/12/15 = 175320 blocks in month, assuming 15 secs per block
    uint24 public blocksToSmoothDividend = 175320;
    uint24 public blocksToSmoothWithdrawal = 116880;
    uint256 public bancorGasPriceLimit = 22000000000;
    IBancorFormula public bancorFormula;
    // fees in ppm
    uint32 public buyFee;
    uint32 public sellFee;
    TPEG public stableToken;

    RENTLogic public rentLogic;

    LiquidFactory public liquidFactory;
    mapping(uint8 => IREOLogic) public ireoLogic;
    mapping(uint8 => LRETLogic) public lretLogic;
    mapping(uint8 => ConverterLogic) public converterLogic;
    mapping(uint8 => VotingLogic) public votingLogic;
    address[] public properties;
    mapping(address => ExistsAndArrayIndex) public propertyInfo;
    uint256 public propertyCount;
    // we need investor's country code from ISO 3166-1 numeric to potentially restrict usage
    struct Investor {
        bool verified;
        uint256 arrayIndex;
        uint16 countryCode;
        uint40 created;
    }
    address[] public investors;
    mapping(address => Investor) public investorInfo;
    uint256 public investorCount;
    // we need trustee name and address
    struct Trustee {
        bool verified;
        uint256 arrayIndex;
        string name;
        string mailingAddress;
        uint40 created;
    }
    address[] public trustees;
    mapping(address => Trustee) public trusteeInfo;
    uint256 public trusteeCount;
    struct Seller {
        bool verified;
        uint256 arrayIndex;
        uint40 created;
    }
    address[] public sellers;
    mapping(address => Seller) public sellerInfo;
    uint256 public sellerCount;

    event ActiveChanged(bool active);
    event NewProperty(address indexed property);
    event RemovedProperty(address indexed property);
    event NewInvestor(address indexed investor);
    event NewTrustee(address indexed trustee);
    event RemovedTrustee(address indexed trustee);
    event ModifiedTrustee(address indexed trustee);
    event NewSeller(address indexed seller);
    event RemovedSeller(address indexed seller);
    event LRETLogicUpgrade(address indexed logicContract, uint8 propertyVersion);
    event IREOLogicUpgrade(address indexed logicContract, uint8 propertyVersion);
    event ConverterLogicUpgrade(address indexed logicContract, uint8 propertyVersion);
    event VotingLogicUpgrade(address indexed logicContract, uint8 propertyVersion);
    event LiquidFactoryUpgrade(address indexed factory);
    event RENTLogicUpgrade(address indexed rentLogic);
    event StableTokenUpgrade(address indexed stableToken);

    function LiquidRE() public {
        administratorInfo[msg.sender] = ExistsAndArrayIndex({exists: true, arrayIndex: 0});
        administrators.push(msg.sender);
    }

    modifier administratorOnly() {
        require(isAdministrator(msg.sender));
        _;
    }

    modifier managementOnly() {
        require(isManager(msg.sender));
        _;
    }

    modifier verifierOnly() {
        require(isVerifier(msg.sender));
        _;
    }

    // getters for arrays
    function getProperties() public view returns (address[]) {
        return properties;
    }

    function getTrustees() public view returns (address[]) {
        return trustees;
    }

    function getSellers() public view returns (address[]) {
        return sellers;
    }

    function getInvestors() public view returns (address[]) {
        return investors;
    }

    function getAdministrators() public view returns (address[]) {
        return administrators;
    }

    function getManagers() public view returns (address[]) {
        return managers;
    }

    function getVerifiers() public view returns (address[]) {
        return verifiers;
    }

    // setters for every variable
    function setActive(bool _active) public administratorOnly {
        active = _active;
        emit ActiveChanged(_active);
    }

    function setBuyFee(uint32 _buyFee) public managementOnly {
        buyFee = _buyFee;
    }

    function setSellFee(uint32 _sellFee) public managementOnly {
        sellFee = _sellFee;
    }

    function setLiquidFactory(LiquidFactory _liquidFactory) public administratorOnly {
        liquidFactory = _liquidFactory;
        emit LiquidFactoryUpgrade(_liquidFactory);
    }

    function setBancorFormula(IBancorFormula _bancorFormula) public administratorOnly {
        bancorFormula = _bancorFormula;
    }

    function setRENTLogic(RENTLogic _rentLogic) public administratorOnly {
        rentLogic = _rentLogic;
        emit RENTLogicUpgrade(_rentLogic);
    }

    function setBlocksToSmoothDividend(uint24 _blocksToSmoothDividend) public managementOnly {
        blocksToSmoothDividend = _blocksToSmoothDividend;
    }

    function setBlocksToSmoothWithdrawal(uint24 _blocksToSmoothWithdrawal) public managementOnly {
        blocksToSmoothWithdrawal = _blocksToSmoothWithdrawal;
    }

    function setBancorGasPriceLimit(uint256 _bancorGasPriceLimit) public managementOnly {
        bancorGasPriceLimit = _bancorGasPriceLimit;
    }

    function setStableToken(TPEG _stableToken) public administratorOnly {
        stableToken = _stableToken;
        emit StableTokenUpgrade(_stableToken);
    }

    function setIREOLogic(IREOLogic _ireoLogic, uint8 _propertyVersion) public administratorOnly {
        ireoLogic[_propertyVersion] = _ireoLogic;
        emit IREOLogicUpgrade(_ireoLogic, _propertyVersion);
    }

    function setLRETLogic(LRETLogic _lretLogic, uint8 _propertyVersion) public administratorOnly {
        lretLogic[_propertyVersion] = _lretLogic;
        emit LRETLogicUpgrade(_lretLogic, _propertyVersion);
    }

    function setConverterLogic(ConverterLogic _converterLogic, uint8 _propertyVersion) public administratorOnly {
        converterLogic[_propertyVersion] = _converterLogic;
        emit ConverterLogicUpgrade(_converterLogic, _propertyVersion);
    }

    function setVotingLogic(VotingLogic _votingLogic, uint8 _propertyVersion) public administratorOnly {
        votingLogic[_propertyVersion] = _votingLogic;
        emit VotingLogicUpgrade(_votingLogic, _propertyVersion);
    }

    function addAdministrator(address _administrator) public administratorOnly {
        require(!administratorInfo[_administrator].exists);
        administratorInfo[_administrator] = ExistsAndArrayIndex({exists: true, arrayIndex: administrators.length});
        administrators.push(_administrator);
    }

    function deleteAdministrator(address _administrator) public administratorOnly {
        require(administratorInfo[_administrator].exists);
        delete administrators[administratorInfo[_administrator].arrayIndex];
        delete administratorInfo[_administrator];
    }

    function addManager(address _manager) public administratorOnly {
        require(!managerInfo[_manager].exists);
        managerInfo[_manager] = ExistsAndArrayIndex({exists: true, arrayIndex: managers.length});
        managers.push(_manager);
    }

    function deleteManager(address _manager) public administratorOnly {
        require(managerInfo[_manager].exists);
        delete managers[managerInfo[_manager].arrayIndex];
        delete managerInfo[_manager];
    }

    function addVerifier(address _verifier) public managementOnly {
        require(!verifierInfo[_verifier].exists);
        verifierInfo[_verifier] = ExistsAndArrayIndex({exists: true, arrayIndex: verifiers.length});
        verifiers.push(_verifier);
    }

    function deleteVerifier(address _verifier) public managementOnly {
        require(verifierInfo[_verifier].exists);
        delete verifiers[verifierInfo[_verifier].arrayIndex];
        delete verifierInfo[_verifier];
    }

    function addProperty(address _property) public managementOnly {
        require(!propertyInfo[_property].exists);
        propertyInfo[_property] = ExistsAndArrayIndex({exists: true, arrayIndex: properties.length});
        properties.push(_property);
        propertyCount++;
        emit NewProperty(_property);
    }

    function deleteProperty(address _property) public managementOnly {
        require(propertyInfo[_property].exists);
        delete properties[propertyInfo[_property].arrayIndex];
        delete propertyInfo[_property];
        propertyCount--;
        emit RemovedProperty(_property);
    }

    function addInvestor(address _investor, uint16 _countryCode) public verifierOnly {
        require(!investorInfo[_investor].verified);
        investorInfo[_investor] = Investor({verified: true, arrayIndex: investors.length, countryCode: _countryCode, created: uint40(now)});
        investors.push(_investor);
        investorCount++;
        emit NewInvestor(_investor);
    }

    function deleteInvestor(address _investor) public verifierOnly {
        require(investorInfo[_investor].verified);
        delete investors[investorInfo[_investor].arrayIndex];
        delete investorInfo[_investor];
        investorCount--;
    }

    function updateInvestor(address _investor, uint16 _countryCode) public verifierOnly {
        require(investorInfo[_investor].verified);
        investorInfo[_investor].countryCode = _countryCode;
    }

    function addTrustee(address _trustee, string _name, string _mailingAddress) public verifierOnly {
        require(!trusteeInfo[_trustee].verified);
        trusteeInfo[_trustee] = Trustee({verified: true, arrayIndex: trustees.length, name: _name, mailingAddress: _mailingAddress, created: uint40(now)});
        trustees.push(_trustee);
        trusteeCount++;
        emit NewTrustee(_trustee);
    }

    function deleteTrustee(address _trustee) public verifierOnly {
        require(trusteeInfo[_trustee].verified);
        delete trustees[trusteeInfo[_trustee].arrayIndex];
        delete trusteeInfo[_trustee];
        trusteeCount--;
        emit RemovedTrustee(_trustee);
    }

    function updateTrustee(address _trustee, string _name, string _mailingAddress) public verifierOnly {
        require(trusteeInfo[_trustee].verified);
        trusteeInfo[_trustee].name = _name;
        trusteeInfo[_trustee].mailingAddress = _mailingAddress;
        emit ModifiedTrustee(_trustee);
    }

    function addSeller(address _seller) public verifierOnly {
        require(!sellerInfo[_seller].verified);
        sellerInfo[_seller] = Seller({verified: true, arrayIndex: sellers.length, created: uint40(now)});
        sellers.push(_seller);
        sellerCount++;
        emit NewSeller(_seller);
    }

    function deleteSeller(address _seller) public verifierOnly {
        require(sellerInfo[_seller].verified);
        delete sellers[sellerInfo[_seller].arrayIndex];
        delete sellerInfo[_seller];
        sellerCount--;
        emit RemovedSeller(_seller);
    }

    // function that allows wallets to remove their own credentials. in case of a compromised private key, they should be able to remove their power instead of waiting for an admin to do it
    function deleteMe() public {
        if (administratorInfo[msg.sender].exists) {
            delete administrators[administratorInfo[msg.sender].arrayIndex];
            delete administratorInfo[msg.sender];
        }
        if (managerInfo[msg.sender].exists) {
            delete managers[managerInfo[msg.sender].arrayIndex];
            delete managerInfo[msg.sender];
        }
        if (verifierInfo[msg.sender].exists) {
            delete verifiers[verifierInfo[msg.sender].arrayIndex];
            delete verifierInfo[msg.sender];
        }
        if (investorInfo[msg.sender].verified) {
            delete investors[investorInfo[msg.sender].arrayIndex];
            delete investorInfo[msg.sender];
            investorCount--;
        }
        if (trusteeInfo[msg.sender].verified) {
            delete trustees[trusteeInfo[msg.sender].arrayIndex];
            delete trusteeInfo[msg.sender];
            trusteeCount--;
            emit RemovedTrustee(msg.sender);
        }
        if (sellerInfo[msg.sender].verified) {
            delete sellers[sellerInfo[msg.sender].arrayIndex];
            delete sellerInfo[msg.sender];
            sellerCount--;
            emit RemovedSeller(msg.sender);
        }
    }

    // setters for factories
    function factoryAddProperty(address _property) public {
        require(msg.sender == address(liquidFactory));
        require(!propertyInfo[_property].exists);
        propertyInfo[_property] = ExistsAndArrayIndex({exists: true, arrayIndex: properties.length});
        properties.push(_property);
        propertyCount++;
        emit NewProperty(_property);
    }

    // getters that return whether an address is authorized
    function isAdministrator(address _address) public view returns (bool) {
        return administratorInfo[_address].exists;
    }

    function isManager(address _address) public view returns (bool) {
        return managerInfo[_address].exists || administratorInfo[_address].exists;
    }

    function isVerifier(address _address) public view returns (bool) {
        return verifierInfo[_address].exists || managerInfo[_address].exists || administratorInfo[_address].exists;
    }

    function isLRETLogic(LRETLogic _address, uint8 _propertyVersion) public view returns (bool) {
        return _address == lretLogic[_propertyVersion];
    }

    function isIREOLogic(IREOLogic _address, uint8 _propertyVersion) public view returns (bool) {
        return _address == ireoLogic[_propertyVersion];
    }

    function isConverterLogic(ConverterLogic _address, uint8 _propertyVersion) public view returns (bool) {
        return _address == converterLogic[_propertyVersion];
    }

    function isVotingLogic(VotingLogic _address, uint8 _propertyVersion) public view returns (bool) {
        return _address == votingLogic[_propertyVersion];
    }

    function isAnyLogic(address _address, uint8 _propertyVersion) public view returns (bool) {
        return _address == address(lretLogic[_propertyVersion]) || _address == address(converterLogic[_propertyVersion]) || _address == address(ireoLogic[_propertyVersion]) || _address == address(votingLogic[_propertyVersion]) || _address == address(liquidFactory) || _address == address(rentLogic);
    }

    function isProperty(address _property) public view returns (bool) {
        return propertyInfo[_property].exists;
    }

    function isInvestor(address _investor) public view returns (bool) {
        return investorInfo[_investor].verified;
    }

    function isTrustee(address _trustee) public view returns (bool) {
        return trusteeInfo[_trustee].verified;
    }

    function isSeller(address _seller) public view returns (bool) {
        return sellerInfo[_seller].verified || trusteeInfo[_seller].verified || investorInfo[_seller].verified;
    }

    function getCountryCode(address _investor) public view returns (uint16) {
        return investorInfo[_investor].countryCode;
    }

    // so this contract is not an ERC20 sink
    function transferERC20Token(IERC20Token _token, address _to, uint256 _amount) public managementOnly {
        assert(_token.transfer(_to, _amount));
    }
}
