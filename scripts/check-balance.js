const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  console.log("📍 Checking wallet balance...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceInEth = hre.ethers.formatEther(balance);
  
  console.log("Balance:", balanceInEth, "ETH");
  
  if (parseFloat(balanceInEth) < 0.01) {
    console.log("⚠️  Low balance! Get Sepolia ETH from:");
    console.log("   https://sepoliafaucet.com/");
    console.log("   https://faucet.quicknode.com/ethereum/sepolia");
  } else {
    console.log("✅ Sufficient balance for deployment");
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


