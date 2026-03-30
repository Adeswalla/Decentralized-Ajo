const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        i++;
      }
    }
  }
  return parsed;
}

const opts = parseArgs(process.argv.slice(2));

if (!opts.network) {
  console.error("[verify.js] Missing required option --network <mainnet|sepolia>");
  process.exit(1);
}

const supported = {
  sepolia: {
    chainId: 11155111,
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  },
  mainnet: {
    chainId: 1,
    priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  },
};

const network = opts.network;
if (!supported[network]) {
  console.error(`[verify.js] Unsupported network '${network}'. Supported: ${Object.keys(supported).join(", ")}`);
  process.exit(1);
}

const cwd = process.cwd();
const deploymentFile = path.resolve(cwd, `deployment-${network}.json`);
let contractAddress = opts.address;

if (!contractAddress) {
  if (!fs.existsSync(deploymentFile)) {
    console.error(`
[verify.js] No deployment file found at ${deploymentFile}.`);
    console.error("Run `npm run deploy:<network>` first or pass --address <contract_address>.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  contractAddress = data.contractAddress;
  if (!contractAddress) {
    console.error(`[verify.js] deployment-${network}.json is missing contractAddress.`);
    process.exit(1);
  }
}

const priceFeedAddress = opts.priceFeed || supported[network].priceFeed;
if (!priceFeedAddress) {
  console.error("[verify.js] No priceFeed address available for this network.");
  process.exit(1);
}

const verifyCommand = `npx hardhat verify --network ${network} ${contractAddress} ${priceFeedAddress}`;
console.log("[verify.js] Running:", verifyCommand);

try {
  execSync(verifyCommand, { stdio: "inherit" });
  console.log("\n[verify.js] Verification command executed. Check explorer for verification status.");
} catch (error) {
  console.error("[verify.js] Verification failed. Please verify the contract address and constructor args.", error.message || error);
  process.exit(1);
}
