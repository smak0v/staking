import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { ethers } from "hardhat";

import { expect } from "chai";

import {
  ContractTransaction,
  ContractFactory,
  BigNumber,
  Contract,
  utils,
} from "ethers";

describe("Staking", () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let staking: Contract;
  let tkn: Contract;

  before(async () => {
    [alice, bob] = await ethers.getSigners();

    const TKN: ContractFactory = await ethers.getContractFactory("TKN");

    tkn = await TKN.deploy(100_000_000);

    await tkn.deployed();

    const distributor: string = alice.address;
    const Staking: ContractFactory = await ethers.getContractFactory("Staking");

    staking = await Staking.deploy(tkn.address, distributor);

    await staking.deployed();
  });

  describe("stake", () => {
    it("Should fail if 0 amount of tokens for stake was passed", async () => {
      await expect(staking.connect(alice).stake(0)).to.be.revertedWith(
        "Staking: can't stake 0 tokens"
      );
    });

    it("Should stake by alice", async () => {
      expect(await staking.totalStaked()).to.equal(0);
      expect(await staking.stakes(alice.address)).to.equal(0);
      expect(
        await staking.accountCumulativeRewardPerStake(alice.address)
      ).to.equal(0);
      expect(await tkn.balanceOf(staking.address)).to.equal(0);

      const amount: BigNumber = BigNumber.from(100);
      const approveTx: ContractTransaction = await tkn
        .connect(alice)
        .approve(staking.address, amount);

      await approveTx.wait();

      const stakeTx: ContractTransaction = await staking
        .connect(alice)
        .stake(amount);

      await stakeTx.wait();

      expect(await staking.totalStaked()).to.equal(amount);
      expect(await staking.stakes(alice.address)).to.equal(amount);
      expect(
        await staking.accountCumulativeRewardPerStake(alice.address)
      ).to.equal(0);
      expect(await tkn.balanceOf(staking.address)).to.equal(amount);
    });

    it("Should stake by bob", async () => {
      const prevTotalStaked: BigNumber = await staking.totalStaked();
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const amount: BigNumber = BigNumber.from(50);
      const transferTx: ContractTransaction = await tkn
        .connect(alice)
        .transfer(bob.address, amount);

      await transferTx.wait();

      const approveTx: ContractTransaction = await tkn
        .connect(bob)
        .approve(staking.address, amount);

      await approveTx.wait();

      const stakeTx: ContractTransaction = await staking
        .connect(bob)
        .stake(amount);

      await stakeTx.wait();

      expect(await staking.totalStaked()).to.equal(prevTotalStaked.add(amount));
      expect(await staking.stakes(bob.address)).to.equal(amount);
      expect(
        await staking.accountCumulativeRewardPerStake(bob.address)
      ).to.equal(0);
      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.add(amount)
      );
    });
  });

  describe("distribute", () => {
    it("Should fail if not distibutor is trying to distribute rewards", async () => {
      await expect(staking.connect(bob).distribute(100)).to.be.revertedWith(
        "Staking: not distributor"
      );
    });

    it("Should fail if 0 amount of tokens for distribution was passed", async () => {
      await expect(staking.connect(alice).distribute(0)).to.be.revertedWith(
        "Staking: zero rewards amount"
      );
    });

    it("should distribue rewards", async () => {
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const totalStaked: BigNumber = await staking.totalStaked();
      const prevCumulativeRewardPerStake: BigNumber =
        await staking.cumulativeRewardPerStake();
      const amount: BigNumber = BigNumber.from(1000);
      const rewardAdded: BigNumber = amount
        .mul(utils.parseEther("1.0"))
        .div(totalStaked);
      const expectedCumulativeRewardPerStake: BigNumber =
        prevCumulativeRewardPerStake.add(rewardAdded);
      const approveTx: ContractTransaction = await tkn
        .connect(alice)
        .approve(staking.address, amount);

      await approveTx.wait();

      const distributeTx: ContractTransaction = await staking
        .connect(alice)
        .distribute(amount);

      await distributeTx.wait();

      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.add(amount)
      );
      expect(await staking.cumulativeRewardPerStake()).to.equal(
        expectedCumulativeRewardPerStake
      );
    });
  });

  describe("setDistributor", async () => {
    it("Should fail if not owner is trying to set distributor", async () => {
      await expect(
        staking.connect(bob).setDistributor(bob.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if new distributor is zero address", async () => {
      await expect(
        staking
          .connect(alice)
          .setDistributor("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Staking: distributor can't be zero address");
    });

    it("Should set a new distributor", async () => {
      expect(await staking.distributor()).to.equal(alice.address);

      const setDistributorTx: ContractTransaction = await staking
        .connect(alice)
        .setDistributor(bob.address);

      await setDistributorTx.wait();

      expect(await staking.distributor()).to.equal(bob.address);
    });
  });

  describe("claimRewards", () => {
    it("Should fail if recipient is zero address", async () => {
      await expect(
        staking
          .connect(bob)
          .claimRewards("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Staking: recipient can't be zero address");
    });

    it("Should claim rewards by bob", async () => {
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const prevBobTknBalance: BigNumber = await tkn.balanceOf(bob.address);
      const cumulativeRewardPerStake: BigNumber =
        await staking.cumulativeRewardPerStake();
      const amountOwedPerToken: BigNumber = cumulativeRewardPerStake.sub(
        await staking.accountCumulativeRewardPerStake(bob.address)
      );
      const claimableAmount: BigNumber = (await staking.stakes(bob.address))
        .mul(amountOwedPerToken)
        .div(utils.parseEther("1.0"));
      const claimRewardsTx: ContractTransaction = await staking
        .connect(bob)
        .claimRewards(bob.address);

      await claimRewardsTx.wait();

      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.sub(claimableAmount)
      );
      expect(await tkn.balanceOf(bob.address)).to.equal(
        prevBobTknBalance.add(claimableAmount)
      );
    });

    it("Should claim rewards by alice", async () => {
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const prevBobTknBalance: BigNumber = await tkn.balanceOf(bob.address);
      const cumulativeRewardPerStake: BigNumber =
        await staking.cumulativeRewardPerStake();
      const amountOwedPerToken: BigNumber = cumulativeRewardPerStake.sub(
        await staking.accountCumulativeRewardPerStake(alice.address)
      );
      const claimableAmount: BigNumber = (await staking.stakes(alice.address))
        .mul(amountOwedPerToken)
        .div(utils.parseEther("1.0"));
      const claimRewardsTx: ContractTransaction = await staking
        .connect(alice)
        .claimRewards(bob.address);

      await claimRewardsTx.wait();

      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.sub(claimableAmount)
      );
      expect(await tkn.balanceOf(bob.address)).to.equal(
        prevBobTknBalance.add(claimableAmount)
      );
    });
  });

  describe("unstake", () => {
    it("Should fail if 0 amount of tokens for unstake was passed", async () => {
      await expect(staking.connect(alice).unstake(0)).to.be.revertedWith(
        "Staking: can't ustake 0 tokens"
      );
    });

    it("Should fail if insufficient amount of tokens for unstake was passed", async () => {
      await expect(staking.connect(alice).unstake(1000)).to.be.revertedWith(
        "Staking: insufficient balance of staked tokens"
      );
    });

    it("Should unstake tokens by alice", async () => {
      const prevTotalStaked: BigNumber = await staking.totalStaked();
      const prevAliceStake: BigNumber = await staking.stakes(alice.address);
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const prevAliceTknBalance: BigNumber = await tkn.balanceOf(alice.address);
      const amount: BigNumber = BigNumber.from(50);
      const unstakeTx: ContractTransaction = await staking
        .connect(alice)
        .unstake(amount);

      await unstakeTx.wait();

      expect(await staking.totalStaked()).to.equal(prevTotalStaked.sub(amount));
      expect(await staking.stakes(alice.address)).to.equal(
        prevAliceStake.sub(amount)
      );
      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.sub(amount)
      );
      expect(await tkn.balanceOf(alice.address)).to.equal(
        prevAliceTknBalance.add(amount)
      );
    });

    it("Should unstake tokens by bob", async () => {
      const prevTotalStaked: BigNumber = await staking.totalStaked();
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const prevBobTknBalance: BigNumber = await tkn.balanceOf(bob.address);
      const amount: BigNumber = BigNumber.from(50);
      const unstakeTx: ContractTransaction = await staking
        .connect(bob)
        .unstake(amount);

      await unstakeTx.wait();

      expect(await staking.totalStaked()).to.equal(prevTotalStaked.sub(amount));
      expect(await staking.stakes(bob.address)).to.equal(0);
      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.sub(amount)
      );
      expect(await tkn.balanceOf(bob.address)).to.equal(
        prevBobTknBalance.add(amount)
      );
    });
  });

  describe("integration", () => {
    it("Should distribute rewards only for alice", async () => {
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const totalStaked: BigNumber = await staking.totalStaked();
      const prevCumulativeRewardPerStake: BigNumber =
        await staking.cumulativeRewardPerStake();
      const amount: BigNumber = BigNumber.from(1000);
      const rewardAdded: BigNumber = amount
        .mul(utils.parseEther("1.0"))
        .div(totalStaked);
      const expectedCumulativeRewardPerStake: BigNumber =
        prevCumulativeRewardPerStake.add(rewardAdded);
      const approveTx: ContractTransaction = await tkn
        .connect(bob)
        .approve(staking.address, amount);

      await approveTx.wait();

      const distributeTx: ContractTransaction = await staking
        .connect(bob)
        .distribute(amount);

      await distributeTx.wait();

      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.add(amount)
      );
      expect(await staking.cumulativeRewardPerStake()).to.equal(
        expectedCumulativeRewardPerStake
      );
      expect(await staking.getClaimableRewards(alice.address)).to.equal(amount);
    });

    it("Should stake by bob, claimable amoun should be 0", async () => {
      const amount: BigNumber = BigNumber.from(50);
      const transferTx: ContractTransaction = await tkn
        .connect(alice)
        .transfer(bob.address, amount);

      await transferTx.wait();

      const prevTotalStaked: BigNumber = await staking.totalStaked();
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const prevBobTknBalance: BigNumber = await tkn.balanceOf(bob.address);
      const approveTx: ContractTransaction = await tkn
        .connect(bob)
        .approve(staking.address, amount);

      await approveTx.wait();

      const stakeTx: ContractTransaction = await staking
        .connect(bob)
        .stake(amount);

      await stakeTx.wait();

      expect(await staking.totalStaked()).to.equal(prevTotalStaked.add(amount));
      expect(await staking.stakes(bob.address)).to.equal(amount);
      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.add(amount)
      );
      expect(await tkn.balanceOf(bob.address)).to.equal(
        prevBobTknBalance.sub(amount)
      );
      expect(await staking.getClaimableRewards(bob.address)).to.equal(0);
    });

    it("Should distribute rewards for alice and bob", async () => {
      const prevStakingTknBalance: BigNumber = await tkn.balanceOf(
        staking.address
      );
      const totalStaked: BigNumber = await staking.totalStaked();
      const prevCumulativeRewardPerStake: BigNumber =
        await staking.cumulativeRewardPerStake();
      const amount: BigNumber = BigNumber.from(1000);
      const rewardAdded: BigNumber = amount
        .mul(utils.parseEther("1.0"))
        .div(totalStaked);
      const expectedCumulativeRewardPerStake: BigNumber =
        prevCumulativeRewardPerStake.add(rewardAdded);

      const transferTx: ContractTransaction = await tkn
        .connect(alice)
        .transfer(bob.address, amount);

      await transferTx.wait();

      const approveTx: ContractTransaction = await tkn
        .connect(bob)
        .approve(staking.address, amount);

      await approveTx.wait();

      const distributeTx: ContractTransaction = await staking
        .connect(bob)
        .distribute(amount);

      await distributeTx.wait();

      expect(await tkn.balanceOf(staking.address)).to.equal(
        prevStakingTknBalance.add(amount)
      );
      expect(await staking.cumulativeRewardPerStake()).to.equal(
        expectedCumulativeRewardPerStake
      );
      expect(await staking.getClaimableRewards(alice.address)).to.equal(
        amount.div(2).add(1000)
      );
      expect(await staking.getClaimableRewards(bob.address)).to.equal(
        amount.div(2)
      );
    });
  });
});
