const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying AjoCircle contract...");

  // Network-specific price feed addresses
  const network = await ethers.provider.getNetwork();
  let priceFeedAddress;

  switch (network.chainId) {
    case 11155111: // Sepolia
      priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
      console.log("Using Sepolia ETH/USD Price Feed");
      break;
    case 1: // Mainnet
      priceFeedAddress = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
      console.log("Using Mainnet ETH/USD Price Feed");
      break;
    default:
      // For local testing, use a mock address
      priceFeedAddress = ethers.constants.AddressZero;
      console.log("Using mock price feed for local testing");
  }

  // Deploy the contract
  const AjoCircle = await ethers.getContractFactory("AjoCircle");
  const ajoCircle = await AjoCircle.deploy(priceFeedAddress);

  await ajoCircle.deployed();

  console.log("AjoCircle deployed to:", ajoCircle.address);
  console.log("Transaction hash:", ajoCircle.deployTransaction.hash);
  console.log("Price feed address:", priceFeedAddress);

  // Verify deployment by checking the price feed
  try {
    const latestPrice = await ajoCircle.getLatestETHUSDPrice();
    console.log("Current ETH/USD Price:", ethers.utils.formatUnits(latestPrice, 8));
  } catch (error) {
    console.log("Note: Price feed may not be available on this network");
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    contractAddress: ajoCircle.address,
    priceFeedAddress: priceFeedAddress,
    deployer: await ethers.provider.getSigner().getAddress(),
    deployedAt: new Date().toISOString(),
    transactionHash: ajoCircle.deployTransaction.hash
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployment-${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployment-" + network.name + ".json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
