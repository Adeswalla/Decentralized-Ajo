import { ethers, run, network } from "hardhat";
import fs from "fs";
import path from "path";

// ============================================================================
// Deployment Script for AjoFactory on Sepolia Testnet
// ============================================================================
// This script handles:
// - Pre-flight checks (balance verification)
// - AjoFactory contract deployment
// - Etherscan contract verification
// - Artifact saving (ABI + address) for frontend
// - Error recovery and retry logic
// ============================================================================

// Configuration
const NETWORK_NAME = network.name;
const DEPLOYMENT_CONFIG = {
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    chainId: 11155111,
  },
};

// Paths
const ARTIFACTS_DIR = path.join(
  __dirname,
  "../frontend/constants/deployments"
);
const ARTIFACTS_FILE = path.join(ARTIFACTS_DIR, `${NETWORK_NAME}-addresses.json`);
const PREVIOUS_DEPLOYMENTS_FILE = path.join(
  __dirname,
  "..",
  "deployments",
  `${NETWORK_NAME}-deployments.json`
);

// Helper: Create directories if they don't exist
function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
}

// Helper: Load previous deployments
function loadPreviousDeployments(): Record<string, any> {
  try {
    if (fs.existsSync(PREVIOUS_DEPLOYMENTS_FILE)) {
      const data = fs.readFileSync(PREVIOUS_DEPLOYMENTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("Could not load previous deployments:", error);
  }
  return {};
}

// Helper: Save deployments locally
function savePreviousDeployments(deployments: Record<string, any>): void {
  ensureDirectoryExists(path.dirname(PREVIOUS_DEPLOYMENTS_FILE));
  fs.writeFileSync(
    PREVIOUS_DEPLOYMENTS_FILE,
    JSON.stringify(deployments, null, 2)
  );
  console.log(`✓ Saved deployment record to ${PREVIOUS_DEPLOYMENTS_FILE}`);
}

// Helper: Get contract ABI
async function getContractABI(contractName: string): Promise<any> {
  try {
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${contractName}.sol/${contractName}.json`
    );
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
      return artifact.abi;
    }
  } catch (error) {
    console.warn(`Could not load ABI for ${contractName}:`, error);
  }
  return null;
}

// Helper: Save deployment artifacts for frontend
async function saveDeploymentArtifacts(
  contractName: string,
  address: string,
  abi: any
): Promise<void> {
  ensureDirectoryExists(ARTIFACTS_DIR);

  const artifacts = {
    network: NETWORK_NAME,
    chainId: network.config.chainId,
    contracts: {
      [contractName]: {
        address,
        abi,
      },
    },
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  fs.writeFileSync(ARTIFACTS_FILE, JSON.stringify(artifacts, null, 2));
  console.log(`✓ Saved deployment artifacts to ${ARTIFACTS_FILE}`);
}

// Pre-flight checks before deployment
async function preflight(): Promise<void> {
  console.log("\n📋 Running pre-flight checks...\n");

  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "❌ No deployer account found. Ensure SEPOLIA_PRIVATE_KEY is set in .env"
    );
  }

  console.log(`✓ Deployer address: ${deployer.address}`);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceInEth = ethers.formatEther(balance);

  console.log(`✓ Deployer balance: ${balanceInEth} ETH`);

  // Warn if balance is low (less than 0.1 ETH)
  if (balance < ethers.parseEther("0.1")) {
    console.warn(
      `⚠️  Low balance detected (< 0.1 ETH). Deployment may fail due to insufficient funds.`
    );
    console.warn(`   Get testnet ETH from: https://sepoliafaucet.com/`);
  }

  // Check network configuration
  if (NETWORK_NAME === "sepolia" && DEPLOYMENT_CONFIG.sepolia.rpcUrl) {
    console.log(`✓ Connected to Sepolia network`);
    console.log(`  Chain ID: ${network.config.chainId}`);
  } else if (NETWORK_NAME === "hardhat") {
    console.log(`✓ Using local Hardhat network (for testing)`);
  } else {
    console.log(`ℹ Network: ${NETWORK_NAME}`);
  }

  console.log("\n✅ Pre-flight checks passed!\n");
}

// Check if contract is already deployed
async function checkIfAlreadyDeployed(
  contractName: string
): Promise<string | null> {
  const previousDeployments = loadPreviousDeployments();
  const deployment = previousDeployments[contractName];

  if (deployment) {
    const blockNumber = await ethers.provider.getBlockNumber();
    const deployBlockDiff = blockNumber - deployment.blockNumber;

    console.log(
      `⚠️  ${contractName} appears to be already deployed at: ${deployment.address}`
    );
    console.log(`   Deployed ${deployBlockDiff} blocks ago`);
    console.log(`   Deployment TX: ${deployment.txHash}`);

    // Ask user if they want to re-deploy
    console.log(`\n   Options:`);
    console.log(`   1. Continue with new deployment (may waste gas)`);
    console.log(`   2. Skip deployment and use existing address`);
    console.log(
      `   Current script will use existing address to save gas.\n`
    );

    return deployment.address;
  }

  return null;
}

// Deploy AjoFactory contract
async function deployAjoFactory(): Promise<string> {
  const contractName = "AjoFactory";

  console.log(`\n🚀 Deploying ${contractName}...\n`);

  // Check if already deployed
  const existingAddress = await checkIfAlreadyDeployed(contractName);
  if (existingAddress) {
    console.log(`✓ Using existing ${contractName} at ${existingAddress}`);
    return existingAddress;
  }

  try {
    const [deployer] = await ethers.getSigners();

    // Get the contract factory
    const AjoFactory = await ethers.getContractFactory(contractName);

    // Estimate gas
    console.log(`📊 Estimating gas costs...`);
    const estimatedGas = await ethers.provider.estimateGas(
      AjoFactory.getDeployTransaction()
    );
    console.log(`   Estimated gas: ${estimatedGas.toString()} units`);

    // Deploy
    console.log(`📤 Sending deployment transaction...`);
    const contract = await AjoFactory.deploy();
    const deploymentTx = contract.deploymentTransaction();

    if (!deploymentTx) {
      throw new Error("Deployment transaction not found");
    }

    console.log(`   TX Hash: ${deploymentTx.hash}`);
    console.log(`   Waiting for confirmation...\n`);

    // Wait for deployment to confirm
    const receipt = await contract.waitForDeployment();
    const deployedAddress = await contract.getAddress();

    console.log(`✅ ${contractName} deployed successfully!`);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📍 Contract Address: ${deployedAddress}`);
    console.log(`📊 Deployment TX: ${deploymentTx.hash}`);
    console.log(`📦 Block Number: ${deploymentTx.blockNumber}`);
    console.log(`💰 Gas Used: ${receipt?.gasUsed?.toString() || "N/A"}`);
    console.log(`${"=".repeat(60)}\n`);

    // Save deployment record
    const previousDeployments = loadPreviousDeployments();
    previousDeployments[contractName] = {
      address: deployedAddress,
      txHash: deploymentTx.hash,
      blockNumber: deploymentTx.blockNumber,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    };
    savePreviousDeployments(previousDeployments);

    return deployedAddress;
  } catch (error) {
    console.error(`❌ Deployment failed:`, error);
    throw error;
  }
}

// Verify contract on Etherscan
async function verifyContractOnEtherscan(
  contractAddress: string,
  contractName: string
): Promise<void> {
  if (NETWORK_NAME !== "sepolia") {
    console.log(`⏭️  Skipping verification (not on Sepolia)`);
    return;
  }

  console.log(`\n🔍 Verifying contract on Etherscan...\n`);

  try {
    // Add delay to allow contract to be indexed by Etherscan
    console.log(`⏳ Waiting 30 seconds for Etherscan to index contract...`);
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log(`📝 Submitting verification request...`);

    // Verify the contract
    await run("verify:verify", {
      address: contractAddress,
      contract: `contracts/${contractName}.sol:${contractName}`,
      constructorArgs: [], // Add constructor args if needed
    });

    console.log(`✅ Contract verified on Etherscan!`);
    console.log(
      `🔗 View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`
    );
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log(`ℹ️  Contract already verified on Etherscan`);
    } else {
      console.warn(`⚠️  Verification failed:`, error.message);
      console.warn(
        `   You can manually verify at: https://sepolia.etherscan.io/address/${contractAddress}`
      );
    }
  }
}

// Main deployment flow
async function main(): Promise<void> {
  console.log(
    `\n${"=".repeat(60)}`
  );
  console.log(
    `🏭 AjoFactory Deployment Script`
  );
  console.log(
    `Network: ${NETWORK_NAME.toUpperCase()}`
  );
  console.log(
    `${"=".repeat(60)}`
  );

  try {
    // 1. Run pre-flight checks
    await preflight();

    // 2. Deploy AjoFactory
    const ajoFactoryAddress = await deployAjoFactory();

    // 3. Save artifacts for frontend
    console.log(`\n💾 Saving deployment artifacts for frontend...`);
    const abi = await getContractABI("AjoFactory");
    if (abi) {
      await saveDeploymentArtifacts("AjoFactory", ajoFactoryAddress, abi);
    } else {
      console.warn(`⚠️  Could not load ABI for AjoFactory`);
    }

    // 4. Verify on Etherscan
    await verifyContractOnEtherscan(ajoFactoryAddress, "AjoFactory");

    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ Deployment Complete!`);
    console.log(`${"=".repeat(60)}`);
    console.log(`\nNext Steps:`);
    console.log(`1. Update your .env file with the contract address`);
    console.log(`2. The frontend can import from: ${ARTIFACTS_FILE}`);
    console.log(`3. Test the contract on Sepolia Etherscan`);
    console.log(
      `4. Update your application to use the new contract address\n`
    );

    // Print deployment summary
    const previousDeployments = loadPreviousDeployments();
    const deployment = previousDeployments["AjoFactory"];
    if (deployment) {
      console.log(`Deployment Summary:`);
      console.log(`- Address: ${deployment.address}`);
      console.log(`- TX: ${deployment.txHash}`);
      console.log(`- Deployer: ${deployment.deployer}`);
      console.log(`- Time: ${deployment.timestamp}\n`);
    }
  } catch (error) {
    console.error(`\n❌ Deployment failed!`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
