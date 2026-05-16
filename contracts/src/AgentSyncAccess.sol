// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentSyncAccess {
    uint256 public constant PRICE    = 0.01 ether;
    uint256 public constant DURATION = 24 hours;

    address public owner;
    mapping(address => uint256) public accessExpiry;

    event AccessGranted(address indexed user, uint256 expiry);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function purchaseAccess() external payable {
        require(msg.value >= PRICE, "Insufficient payment");
        accessExpiry[msg.sender] = block.timestamp + DURATION;
        emit AccessGranted(msg.sender, accessExpiry[msg.sender]);
    }

    function hasAccess(address user) external view returns (bool) {
        return accessExpiry[user] > block.timestamp;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");
        payable(owner).transfer(balance);
        emit Withdrawn(owner, balance);
    }
}
