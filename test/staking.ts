import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Contract, ContractFactory } from "ethers";

import { ethers } from "hardhat";

import { expect } from "chai";

describe("Staking", function () {
  let tkn: Contract;
  let staking: Contract;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  before(async function () {
    [alice, bob] = await ethers.getSigners();

    const TKN: ContractFactory = await ethers.getContractFactory("TKN");

    tkn = await TKN.deploy(100_000_000);

    await tkn.deployed();

    const distributor: string = alice.address;
    const Staking: ContractFactory = await ethers.getContractFactory("Staking");

    staking = await Staking.deploy(tkn.address, distributor);

    await staking.deployed();
  });

  it("Should stake by alice", async function () {
    expect(await staking.totalStaked()).to.equal(0);

    const amount: number = 100;
    const approveTx = await tkn.connect(alice).approve(staking.address, amount);

    await approveTx.wait();

    const stakeTx = await staking.connect(alice).stake(amount);

    await stakeTx.wait();

    expect(await staking.totalStaked()).to.equal(amount);
  });

  it("Should stake by bob", async function () {
    const prevTotalStaked: number = (await staking.totalStaked()).toNumber();
    const amount: number = 50;
    const transferTx = await tkn.connect(alice).transfer(bob.address, amount);

    await transferTx.wait();

    const approveTx = await tkn.connect(bob).approve(staking.address, amount);

    await approveTx.wait();

    const stakeTx = await staking.connect(bob).stake(amount);

    await stakeTx.wait();

    expect(await staking.totalStaked()).to.equal(prevTotalStaked + amount);
  });
});
