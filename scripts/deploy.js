const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Privabuild to Sepolia...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy Privabuild contract
  console.log("\n⏳ Deploying Privabuild contract...");
  const Privabuild = await hre.ethers.getContractFactory("Privabuild");
  const privabuild = await Privabuild.deploy();

  await privabuild.waitForDeployment();
  const address = await privabuild.getAddress();

  console.log("✅ Privabuild deployed to:", address);

  // Save contract configuration
  const config = {
    contractAddress: address,
    contractName: "Privabuild",
    chainId: 11155111,
    networkName: "sepolia",
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  const configPath = path.join(__dirname, "../lib/contract-config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log("\n📝 Configuration saved to lib/contract-config.json");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n🔗 Verify on Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${address}`);
  console.log("\n💡 Add this to your .env:");
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });



