pragma solidity ^0.4.21;

import "./LiquidREPointer.sol";
import "./LiquidRE.sol";
import "./LiquidProperty.sol";
import "./IERC20Token.sol";
import "./AntiERC20Sink.sol";

contract LRETLogic is AntiERC20Sink {

    uint8 public constant version = 0;

    LiquidREPointer public liquidREPointer;

    event TransfersToggle(address indexed property, bool enable);
    event PropertyNameChange(address indexed property, string name);
    event Issuance(address indexed property, uint256 amount);
    event Destruction(address indexed property, uint256 amount);
    event Transfer(address indexed property, address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed property, address indexed owner, address indexed spender, uint256 amount);

    function LRETLogic(LiquidREPointer _liquidREPointer) public {
        liquidREPointer = _liquidREPointer;
    }

    modifier active() {
        isActive();
        _;
    }

    modifier investorOnly(address _investor) {
        require(liquidREPointer.liquidRE().isInvestor(_investor));
        _;
    }

    modifier trusteeOnly() {
        require(liquidREPointer.liquidRE().isTrustee(msg.sender));
        _;
    }

    modifier anyLogicOnly(LiquidProperty _property) {
        require(liquidREPointer.liquidRE().isAnyLogic(msg.sender, _property.version()));
        _;
    }

    function isActive() internal view {
        require(liquidREPointer.liquidRE().active());
    }

    // allows trustee to enable/disable transfers
    function toggleTransfers(LiquidProperty _property, bool _enable) public active trusteeOnly {
        require(msg.sender == _property.trustee());
        LiquidProperty.Status status = _property.status();
        if (status == LiquidProperty.Status.Withdrawn && _enable || status == LiquidProperty.Status.Frozen && _enable) {
            _property.setStatus(LiquidProperty.Status.Trading);
        } else if (status == LiquidProperty.Status.Trading && !_enable) {
            _property.setStatus(LiquidProperty.Status.Frozen);
        } else {
            revert();
        }
        emit TransfersToggle(_property, _enable);
    }

    function setGlobalWhitelistEnabled(LiquidProperty _property, bool _globalWhitelistEnabled) public active trusteeOnly {
        require(msg.sender == _property.trustee());
        _property.setGlobalWhitelistEnabled(_globalWhitelistEnabled);
    }

    function setLocalCountryBlacklist(LiquidProperty _property, uint16 _countryCode, bool _blocked) public active trusteeOnly {
        require(msg.sender == _property.trustee());
        _property.setLocalCountryBlacklist(_countryCode, _blocked);
    }

    function addToWhitelist(LiquidProperty _property, address _investor) public active trusteeOnly {
        require(msg.sender == _property.trustee());
        _property.addToWhitelist(_investor);
    }

    function deleteFromWhiteList(LiquidProperty _property, address _investor) public active trusteeOnly {
        require(msg.sender == _property.trustee());
        _property.deleteFromWhiteList(_investor);
    }

    function changePropertyAddress(LiquidProperty _property, string _name) public active trusteeOnly {
        require(msg.sender == _property.trustee());
        _property.setName(_name);
        emit PropertyNameChange(_property, _name);
    }

    function issue(LiquidProperty _property, address _to, uint256 _amount) public active anyLogicOnly(_property) {
        // _property.addTotalSupply(_amount);
        _property.addBalanceOf(_to, _amount);
        _property.addBeneficiary(_to);
        emit Issuance(_property, _amount);
        emit Transfer(_property, _property, _to, _amount);
    }

    function destroy(LiquidProperty _property, address _from, uint256 _amount) public active anyLogicOnly(_property) {
        // _property.subTotalSupply(_amount);
        _property.subBalanceOf(_from, _amount);
        emit Destruction(_property, _amount);
        emit Transfer(_property, _from, _property, _amount);
    }

    // ERC20 calls by LRET holders, to be implemented in future versions MAYBE
    // function transfer(LiquidProperty _property, address _to, uint256 _amount) public active validProperty(_property) investorOnly(_to) anyLogicOnly(_property) {
    //     _property.subBalanceOf(msg.sender, _amount);
    //     _property.addBalanceOf(_to, _amount);
    //     _property.addBeneficiary(msg.sender);
    //     _property.addBeneficiary(_to);
    //     _property.emitTransfer(msg.sender, _to, _amount);
    //     emit Transfer(_property, msg.sender, _to, _amount);
    // }

    // function transferFrom(LiquidProperty _property, address _from, address _to, uint256 _amount) public active investorOnly(_from) investorOnly(_to) anyLogicOnly(_property) {
    //     _property.subAllowance(_from, msg.sender, _amount);
    //     _property.subBalanceOf(_from, _amount);
    //     _property.addBalanceOf(_to, _amount);
    //     _property.addBeneficiary(msg.sender);
    //     _property.addBeneficiary(_from);
    //     _property.addBeneficiary(_to);
    //     _property.emitTransfer(_from, _to, _amount);
    //     emit Transfer(_property, _from, _to, _amount);
    // }

    function approve(LiquidProperty _property, address _spender, uint256 _amount) public active {
        // require(_amount == 0 || _property.allowance(msg.sender, _spender) == 0);
        _property.setAllowance(msg.sender, _spender, _amount);
        _property.emitApproval(msg.sender, _spender, _amount);
        emit Approval(_property, msg.sender, _spender, _amount);
    }

    // circular calls from a property itself, in case someone calls erc20 functions directly on it. TO BE IMPLEMENTED IN FUTURE VERSIONS MAYBE
    function transferByProperty(address _to, uint256 _amount, address _sender) public {
        revert();
    }

    function transferFromByProperty(address _from, address _to, uint256 _amount, address _sender) public {
        revert();
    }

    function approveByProperty(address _spender, uint256 _amount, address _sender) public active {
        LiquidProperty property = LiquidProperty(msg.sender);
        // require(_amount == 0 || property.allowance(_sender, _spender) == 0);
        property.setAllowance(_sender, _spender, _amount);
        property.emitApproval(_sender, _spender, _amount);
        emit Approval(msg.sender, _sender, _spender, _amount);
    }
}
