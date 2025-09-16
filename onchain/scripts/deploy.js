const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const treasury =
    process.env.TREASURY && process.env.TREASURY !== ""
      ? process.env.TREASURY
      : deployer.address;
  console.log("Treasury:", treasury);

  // 1) Deploy TGT
  const TGT = await ethers.getContractFactory("TGT");
  const tgt = await TGT.deploy();
  await tgt.waitForDeployment();
  const tgtAddr = await tgt.getAddress();
  console.log("TGT deployed:", tgtAddr);

  // 2) Deploy Escrow (treasury + TGT address)
  const Escrow = await ethers.getContractFactory("TangentEscrow");
  const escrow = await Escrow.deploy(tgtAddr, treasury);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("Escrow deployed:", escrowAddr);

  // 3) Grant MINTER_ROLE on TGT to Escrow
  const MINTER_ROLE = await tgt.MINTER_ROLE();
  const tx = await tgt.grantRole(MINTER_ROLE, escrowAddr);
  await tx.wait();
  console.log("Granted MINTER_ROLE to Escrow.");

  console.log("\n==== Addresses ====");
  console.log("TGT:", tgtAddr);
  console.log("Escrow:", escrowAddr);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
