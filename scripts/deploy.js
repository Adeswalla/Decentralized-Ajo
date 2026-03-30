const hre = require("hardhat");

async function main() {
  const implementation = await hre.ethers.deployContract("Ajo");
  await implementation.waitForDeployment();
  console.log(`Ajo implementation deployed to ${implementation.target}`);

  const AjoFactory = await hre.ethers.getContractFactory("AjoFactory");
  const factory = await AjoFactory.deploy(implementation.target);
  await factory.waitForDeployment();
  console.log(`AjoFactory deployed to ${factory.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
