/**
 * @file scripts/verify.ts
 * @description  Post-deploy Etherscan verification for AjoCircle + AjoFactory.
 *               Reads the deployment manifest written by deploy.js so
 *               constructor arguments are always in sync with on-chain state.
 *
 * Usage (issue #165):
 *   npx hardhat run scripts/verify.ts --network sepolia
 *
 * Prerequisites:
 *   - ETHERSCAN_API_KEY set in your .env
 *   - contracts/ethereum/deployed-sepolia.json populated by the deploy script
 */

// @ts-ignore
import { run, network } from "hardhat";
import fs from "fs";
import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractEntry {
    address: string | null;
    txHash: string | null;
    role: string;
}

interface DeploymentManifest {
    network: string;
    chainId: number;
    contracts: {
        AjoCircle?: ContractEntry;
        AjoFactory?: ContractEntry;
        [key: string]: ContractEntry | undefined;
    };
    chainlink?: {
        ethUsdPriceFeed: string;
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call hardhat's verify:verify task and handle common non-fatal errors gracefully.
 */
async function verifyContract(
    label: string,
    address: string,
    constructorArguments: unknown[],
    contract?: string
): Promise<void> {
    console.log(`\n▸ Verifying ${label} at ${address} …`);
    try {
        await run("verify:verify", {
            address,
            constructorArguments,
            ...(contract ? { contract } : {}),
        });
        console.log(`  ✓ ${label} verified successfully.`);
    } catch (err: any) {
        const msg: string = err?.message ?? String(err);

        if (/already verified/i.test(msg)) {
            console.log(`  ℹ  ${label} is already verified — skipping.`);
        } else if (/does not have bytecode/i.test(msg)) {
            console.warn(
                `  ⚠  ${label}: contract not yet visible on Etherscan. ` +
                `Try again in a minute or verify manually:\n` +
                `     npx hardhat verify --network ${network.name} ${address}`
            );
        } else {
            // Re-throw unexpected errors so the CI pipeline can catch them.
            throw err;
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const NET = network.name;
    const SEP = "═".repeat(54);

    console.log(`\n${SEP}`);
    console.log(`  Ajo Contracts — Etherscan Verification`);
    console.log(`  Network : ${NET.toUpperCase()}`);
    console.log(SEP);

    // ── Guard: skip on local networks ──────────────────────────────────────────
    if (NET === "hardhat" || NET === "localhost") {
        console.log(`⏭  Skipping verification on local network '${NET}'.`);
        return;
    }

    // ── Guard: require API key ─────────────────────────────────────────────────
    if (!process.env.ETHERSCAN_API_KEY) {
        console.error(
            `❌  ETHERSCAN_API_KEY is not set.\n` +
            `    Obtain one at https://etherscan.io/myapikey and add it to your .env.`
        );
        process.exit(1);
    }

    // ── Load deployment manifest ───────────────────────────────────────────────
    const manifestPath = path.join(
        __dirname,
        "../contracts/ethereum",
        `deployed-${NET}.json`
    );

    if (!fs.existsSync(manifestPath)) {
        console.error(
            `❌  Deployment manifest not found: ${manifestPath}\n` +
            `    Run the deploy script first:\n` +
            `    npx hardhat run contracts/ethereum/scripts/deploy.js --network ${NET}`
        );
        process.exit(1);
    }

    const manifest: DeploymentManifest = JSON.parse(
        fs.readFileSync(manifestPath, "utf-8")
    );

    const ajoCircleEntry = manifest.contracts?.AjoCircle;
    const ajoFactoryEntry = manifest.contracts?.AjoFactory;
    const priceFeedAddress =
        manifest.chainlink?.ethUsdPriceFeed ??
        "0x0000000000000000000000000000000000000000";

    if (!ajoCircleEntry?.address || !ajoFactoryEntry?.address) {
        console.error(
            `❌  One or both contract addresses are null in ${manifestPath}.\n` +
            `    Please deploy first and ensure the manifest is populated.`
        );
        process.exit(1);
    }

    // After the guard above TypeScript cannot narrow through process.exit(),
    // so we extract typed string constants to eliminate string | null errors.
    const circleAddr: string = ajoCircleEntry!.address!;
    const factoryAddr: string = ajoFactoryEntry!.address!;

    console.log(`\nLoaded deployment manifest:`);
    console.log(`  AjoCircle  : ${circleAddr}`);
    console.log(`  AjoFactory : ${factoryAddr}`);
    console.log(`  Price Feed : ${priceFeedAddress}`);

    // ── Wait for Etherscan to index ────────────────────────────────────────────
    const WAIT_MS = 30_000;
    console.log(
        `\n⏳  Waiting ${WAIT_MS / 1000}s for Etherscan to index the contracts …`
    );
    await sleep(WAIT_MS);

    // ── Verify AjoCircle ───────────────────────────────────────────────────────
    // AjoCircle uses `_disableInitializers()` in its empty constructor — no
    // user-facing constructor args are needed. The full contract path
    // disambiguates it from the stub AjoCircle.sol in the top-level contracts/.
    await verifyContract(
        "AjoCircle",
        circleAddr,
        [], // constructor() { _disableInitializers(); } — no args
        "contracts/ethereum/contracts/AjoCircle.sol:AjoCircle"
    );

    // ── Verify AjoFactory ──────────────────────────────────────────────────────
    // AjoFactory(address _implementation) — deployed with AjoCircle's address.
    await verifyContract(
        "AjoFactory",
        factoryAddr,
        [circleAddr],
        "contracts/ethereum/contracts/AjoFactory.sol:AjoFactory"
    );

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log(`\n${SEP}`);
    console.log(`  Verification Complete`);
    console.log(SEP);
    console.log(`\nExplorer links:`);
    console.log(
        `  AjoCircle  → https://${NET}.etherscan.io/address/${circleAddr}#code`
    );
    console.log(
        `  AjoFactory → https://${NET}.etherscan.io/address/${factoryAddr}#code`
    );
    console.log();
}

main().catch((err: unknown) => {
    console.error("\n✗ Verification failed:", err);
    process.exit(1);
});
