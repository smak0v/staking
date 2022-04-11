//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is Ownable {
    using SafeMath for uint256;

    mapping(address => uint256) public stakes;
    mapping(address => uint256) public accountCumulativeRewardPerStake;

    uint256 public cumulativeRewardPerStake;
    uint256 public totalStaked;

    uint256 public constant PRECISION = 10**18;

    address public tknAddress;
    address public distributor;

    event Staked(address indexed account, uint256 amount);
    event Unstaked(address indexed account, uint256 amount);
    event Claimed(address indexed account, address indexed recipient, uint256 amount);
    event Distributed(uint256 amount);

    modifier onlyDistributor {
        require(msg.sender == distributor, "Staking: not distributor");
        _;
    }

    constructor(address _tknAddress, address _distributor) {
        require(_tknAddress != address(0), "Staking: TKN can't be zero address");
        require(_distributor != address(0), "Staking: distributor can't be zero address");

        tknAddress = _tknAddress;
        distributor = _distributor;
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Staking: can't stake 0 tokens");

        IERC20 tkn = IERC20(tknAddress);

        tkn.transferFrom(msg.sender, address(this), amount);

        if (stakes[msg.sender] == 0) {
            accountCumulativeRewardPerStake[msg.sender] = cumulativeRewardPerStake;
        } else {
            claimRewards(msg.sender);
        }

        stakes[msg.sender] = stakes[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "Staking: can't ustake 0 tokens");
        require(amount <= stakes[msg.sender], "Staking: insufficient balance of staked tokens");

        claimRewards(msg.sender);
        safeTokenTransfer(tknAddress, msg.sender, amount);

        stakes[msg.sender] = stakes[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);

        emit Unstaked(msg.sender, amount);
    }

    function claimRewards(address recipient) public {
        require(recipient != address(0), "Staking: recipient can't be zero address");

        uint256 amountOwedPerToken =
            cumulativeRewardPerStake.sub(accountCumulativeRewardPerStake[msg.sender]);
        uint256 claimableAmount =
            stakes[msg.sender].mul(amountOwedPerToken).div(PRECISION);

        safeTokenTransfer(tknAddress, recipient, claimableAmount);

        accountCumulativeRewardPerStake[msg.sender] = cumulativeRewardPerStake;

        emit Claimed(msg.sender, recipient, claimableAmount);
    }

    function distribute(uint256 rewards) external onlyDistributor {
        if (totalStaked > 0) {
            require(rewards > 0, "Staking: zero rewards amount");

            IERC20 tkn = IERC20(tknAddress);

            tkn.transferFrom(distributor, address(this), rewards);

            uint256 rewardAdded = rewards.mul(PRECISION).div(totalStaked);

            cumulativeRewardPerStake = cumulativeRewardPerStake.add(rewardAdded);

            emit Distributed(rewards);
        }
    }

    function safeTokenTransfer(address tokenAddress, address recipient, uint256 amount) internal {
        IERC20 token = IERC20(tokenAddress);
        uint256 tokenBalance = token.balanceOf(address(this));

        if (amount > tokenBalance) {
            token.transfer(recipient, tokenBalance);
        } else {
            token.transfer(recipient, amount);
        }
    }

    function setDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "Staking: distributor can't be zero address");

        distributor = _distributor;
    }

    function getClaimableRewards(address account) external view returns (uint256) {
        uint256 amountOwedPerToken = cumulativeRewardPerStake.sub(accountCumulativeRewardPerStake[account]);

        return stakes[account].mul(amountOwedPerToken).div(PRECISION);
    }
}
