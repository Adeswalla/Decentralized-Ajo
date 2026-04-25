import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Utility script to check deployment status and contract information
 * Usage: npx hardhat run scripts/check-deployment.ts --network sepolia
 */

async function main(): Promise<void> {
  const NETWORK_NAME = (await ethers.provider.getNetwork()).name;
  const CHAIN_ID = (await ethers.provider.getNetwork()).chainId;

  console.log("\n" + "=".repeat(60));
  console.log("📊 Deployment Status Check");
  console.log("=".repeat(60));

  console.log(`\nNetwork: ${NETWORK_NAME}`);
  console.log(`Chain ID: ${CHAIN_ID}`);

  // Check if deployment artifacts exist
  const deploymentsFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${NETWORK_NAME}-deployments.json`
  );

  if (fs.existsSync(deploymentsFile)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsFile, "utf-8"));

    console.log("\n✅ Found deployment records:");
    console.log(`   File: ${deploymentsFile}\n`);

    for (const [contractName, deployment] of Object.entries(deployments)) {
      console.log(`   📝 ${contractName}`);
      console.log(`      Address:  ${(deployment as any).address}`);
      console.log(`      TX:       ${(deployment as any).txHash}`);
      console.log(`      Block:    ${(deployment as any).blockNumber}`);
      console.log(`      Deployer: ${(deployment as any).deployer}`);
      console.log(`      Time:     ${(deployment as any).timestamp}\n`);

      // Verify contract exists and has code
      if ((deployment as any).address) {
        const code = await ethers.provider.getCode((deployment as any).address);
        if (code !== "0x") {
          console.log(`      ✓ Contract code verified on-chain`);
        } else {
          console.log(`      ⚠️  No code found at this address`);
        }
      }
    }
  } else {
    console.log("\n❌ No deployments found");
    console.log(`   Expected: ${deploymentsFile}`);
    console.log(`\n   Run deployment script first:`);
    console.log(`   pnpm contract:deploy:${NETWORK_NAME}`);
  }

  // Check frontend artifacts
  const artifactsFile = path.join(
    __dirname,
    "..",
    "frontend",
    "constants",
    "deployments",
    `${NETWORK_NAME}-addresses.json`
  );

  console.log("\n" + "-".repeat(60));
  console.log("📦 Frontend Integration");
  console.log("-".repeat(60));

  if (fs.existsSync(artifactsFile)) {
    console.log(`✅ Frontend artifacts found: ${artifactsFile}`);

    const artifacts = JSON.parse(fs.readFileSync(artifactsFile, "utf-8"));
    console.log(
      `   Contracts available: ${Object.keys(artifacts.contracts).join(", ")}`
    );

    console.log(`\n   Usage in frontend:`);
    console.log(`   import deployments from '@/constants/deployments/${NETWORK_NAME}-addresses.json'`);
    console.log(
      `   const address = deployments.contracts.AjoFactory.address`
    );
  } else {
    console.log(
      `❌ Frontend artifacts not found: ${artifactsFile}`
    );
    console.log(
      `   Run deployment script to generate artifacts`
    );
  }

  // Check explorer link
  console.log("\n" + "-".repeat(60));
  console.log("🔗 Block Explorer");
  console.log("-".repeat(60));

  let explorerUrl = "";
  if (NETWORK_NAME === "sepolia") {
    explorerUrl = "https://sepolia.etherscan.io";
  } else if (NETWORK_NAME === "ethereum") {
    explorerUrl = "https://etherscan.io";
  } else if (NETWORK_NAME === "hardhat" || NETWORK_NAME === "localhost") {
    explorerUrl = "N/A (Local network)";
  }

  if (explorerUrl) {
    console.log(`Network: ${explorerUrl}`);

    // Get and display current account balance
    const [signer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(signer.address);
    console.log(`\nSigner Account: ${signer.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
