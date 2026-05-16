import { ethers } from "hardhat";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xF4b1a6eEBb4c4d5F894ad7BD3b2F2Ac596a5cF28";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Satin alan cuzdan:", signer.address);

  const contract = await ethers.getContractAt("AgentSyncAccess", CONTRACT_ADDRESS, signer);

  console.log("Erisim satin aliniyor (0.01 MON)...");
  const tx = await contract.purchaseAccess({ value: ethers.parseEther("0.01") });
  console.log("TX hash:", tx.hash);
  await tx.wait();

  const expiry = await contract.accessExpiry(signer.address);
  const expiryDate = new Date(Number(expiry) * 1000);
  console.log(`✓ Erisim aktif! Bitis: ${expiryDate.toLocaleString('tr-TR')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
