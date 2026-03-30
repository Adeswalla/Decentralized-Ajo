/**
 * Deployment script: AjoCircle (implementation) + AjoFactory
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * Prerequisites:
 *   1. Copy .env.example → .env and fill in PRIVATE_KEY + SEPOLIA_RPC_URL
 *   2. Fund the deployer wallet with Sepolia ETH:
 *      https://sepoliafaucet.com  |  https://faucet.quicknode.com/ethereum/sepolia
 *   3. Run: npm install  (inside contracts/ethereum/)
 */

const { ethers, network, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Chainlink ETH/USD price feed addresses
const PRICE_FEEDS = {
  11155111: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Sepolia
  1: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",        // Mainnet
};

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  console.log("\n══════════════════════════════════════════════");
  console.log("  Ajo Contracts — Sepolia Deployment");
  console.log("══════════════════════════════════════════════");
  console.log(`Network   : ${network.name} (chainId ${chainId})`);
  console.log(`Deployer  : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance   : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 ETH. Fund it via https://sepoliafaucet.com before deploying."
    );
  }

  // ── 1. Resolve Chainlink price feed ──────────────────────────────────────
  const priceFeedAddress =
    PRICE_FEEDS[Number(chainId)] ?? ethers.ZeroAddress;

  if (priceFeedAddress === ethers.ZeroAddress) {
    console.warn(
      `⚠️  No Chainlink price feed configured for chainId ${chainId}. Using ZeroAddress (local/test only).`
    );
  } else {
    console.log(`Price Feed: ${priceFeedAddress}`);
  }

  // ── 2. Deploy AjoCircle (implementation / standalone) ────────────────────
  console.log("\n[1/3] Deploying AjoCircle implementation...");
  const AjoCircle = await ethers.getContractFactory("AjoCircle");
  const ajoCircle = await AjoCircle.deploy(priceFeedAddress);
  await ajoCircle.waitForDeployment();
  const ajoCircleAddress = await ajoCircle.getAddress();
  console.log(`      AjoCircle deployed → ${ajoCircleAddress}`);
  console.log(`      Tx hash            : ${ajoCircle.deploymentTransaction().hash}`);

  // ── 3. Deploy AjoFactory (points to AjoCircle implementation) ────────────
  console.log("\n[2/3] Deploying AjoFactory...");
  const AjoFactory = await ethers.getContractFactory("AjoFactory");
  const ajoFactory = await AjoFactory.deploy(ajoCircleAddress);
  await ajoFactory.waitForDeployment();
  const ajoFactoryAddress = await ajoFactory.getAddress();
  console.log(`      AjoFactory deployed → ${ajoFactoryAddress}`);
  console.log(`      Tx hash             : ${ajoFactory.deploymentTransaction().hash}`);

  // ── 4. Validate deployment ────────────────────────────────────────────────
  console.log("\n[3/3] Validating deployment...");
  const storedImpl = await ajoFactory.implementation();
  if (storedImpl.toLowerCase() !== ajoCircleAddress.toLowerCase()) {
    throw new Error(
      `Validation failed: AjoFactory.implementation() returned ${storedImpl}, expected ${ajoCircleAddress}`
    );
  }
  console.log("      ✓ AjoFactory.implementation() matches AjoCircle address");

  const registryLen = await ajoFactory.getRegistryLength();
  console.log(`      ✓ Registry length: ${registryLen} (empty — ready for use)`);

  // ── 5. Persist deployment info ────────────────────────────────────────────
  const deploymentInfo = {
    network: network.name,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AjoCircle: {
        address: ajoCircleAddress,
        txHash: ajoCircle.deploymentTransaction().hash,
        role: "implementation",
      },
      AjoFactory: {
        address: ajoFactoryAddress,
        txHash: ajoFactory.deploymentTransaction().hash,
        role: "factory",
      },
    },
    chainlink: {
      ethUsdPriceFeed: priceFeedAddress,
    },
  };

  const outPath = path.join(__dirname, "..", `deployed-${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n      Deployment info saved → deployed-${network.name}.json`);

  // ── 6. Etherscan verification (non-blocking) ──────────────────────────────
  if (process.env.ETHERSCAN_API_KEY && network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n══ Etherscan Verification ══════════════════════");
    console.log("Waiting 30s for Etherscan to index the contracts...");
    await new Promise((r) => setTimeout(r, 30_000));

    try {
      await run("verify:verify", {
        address: ajoCircleAddress,
        constructorArguments: [priceFeedAddress],
      });
      console.log("✓ AjoCircle verified on Etherscan");
    } catch (e) {
      console.warn(`⚠️  AjoCircle verification failed: ${e.message}`);
    }

    try {
      await run("verify:verify", {
        address: ajoFactoryAddress,
        constructorArguments: [ajoCircleAddress],
      });
      console.log("✓ AjoFactory verified on Etherscan");
    } catch (e) {
      console.warn(`⚠️  AjoFactory verification failed: ${e.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("══════════════════════════════════════════════");
  console.log(`AjoCircle  : ${ajoCircleAddress}`);
  console.log(`AjoFactory : ${ajoFactoryAddress}`);
  console.log("\nNext steps:");
  console.log("  1. Copy these addresses into your frontend .env:");
  console.log(`     NEXT_PUBLIC_AJO_CIRCLE_ADDRESS=${ajoCircleAddress}`);
  console.log(`     NEXT_PUBLIC_AJO_FACTORY_ADDRESS=${ajoFactoryAddress}`);
  console.log("  2. Commit deployed-sepolia.json to track the deployment.");
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err.message);
  process.exit(1);
});
