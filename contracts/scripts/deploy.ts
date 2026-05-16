import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const AgentSyncAccess = await ethers.getContractFactory("AgentSyncAccess");
  const contract = await AgentSyncAccess.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("AgentSyncAccess deployed to:", address);
  console.log("\nServer .env icin:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
