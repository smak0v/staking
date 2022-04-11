import { Contract, ContractFactory } from "ethers";

import { ethers } from "hardhat";

async function main() {
  const TKN: ContractFactory = await ethers.getContractFactory("TKN");
  const tkn: Contract = await TKN.deploy(100_000_000);

  await tkn.deployed();

  console.log("TKN address: ", tkn.address);

  const distributor: string = (await ethers.getSigners())[0].address;
  const Staking: ContractFactory = await ethers.getContractFactory("Staking");
  const staking: Contract = await Staking.deploy(tkn.address, distributor);

  await staking.deployed();

  console.log("Staking address: ", staking.address);
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
