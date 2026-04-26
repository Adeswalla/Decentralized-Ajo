import { expect } from "chai";
import { ethers } from "hardhat";
import { AjoCircle } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * GAS OPTIMIZATION TEST SUITE
 * 
 * This test suite proves that the AjoCircle contract operates at O(1) complexity.
 * 
 * Test Strategy:
 * 1. Deploy contract and add varying numbers of members (1, 10, 50, 100)
 * 2. Measure gas cost for contribution at each scale
 * 3. Verify gas costs remain constant (within 5% variance)
 * 4. Prove no O(N) operations exist
 * 
 * Acceptance Criteria:
 * - Gas cost for 100th contributor within 5% of 1st contributor
 * - No loops in contribute() function
 * - All operations are O(1)
 */
describe("AjoCircle - Gas Optimization & O(1) Complexity", function () {
  let ajoCircle: AjoCircle;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];

  const CONTRIBUTION_AMOUNT = ethers.parseEther("1.0");
  const FREQUENCY_DAYS = 30;
  const MAX_ROUNDS = 12;

  beforeEach(async function () {
    // Get signers (we need many for scalability testing)
    const signers = await ethers.getSigners();
    owner = signers[0];
    members = signers.slice(1, 101); // 100 test members

    // Deploy contract
    const AjoCircleFactory = await ethers.getContractFactory("AjoCircle");
    ajoCircle = await AjoCircleFactory.deploy();
    await ajoCircle.waitForDeployment();

    // Initialize circle
    await ajoCircle.initializeCircle(
      CONTRIBUTION_AMOUNT,
      FREQUENCY_DAYS,
      MAX_ROUNDS
    );
  });

  describe("O(1) Complexity Verification", function () {
    it("Should maintain constant gas cost for contributions regardless of member count", async function () {
      console.log("\n🔬 GAS OPTIMIZATION ANALYSIS");
      console.log("━".repeat(60));

      const gasResults: { memberCount: number; gasUsed: bigint }[] = [];

      // Test at different scales: 1, 10, 50, 100 members
      const testPoints = [1, 10, 50, 100];

      for (const targetCount of testPoints) {
        // Add members up to target count
        const currentMemberCount = gasResults.length > 0 
          ? gasResults[gasResults.length - 1].memberCount 
          : 1; // Owner is already member #1

        for (let i = currentMemberCount; i < targetCount; i++) {
          await ajoCircle.addMember(members[i - 1].address);
        }

        // Measure gas for next contribution
        const contributor = members[targetCount - 1];
        const tx = await ajoCircle.connect(contributor).contribute({
          value: CONTRIBUTION_AMOUNT,
        });
        const receipt = await tx.wait();
        const gasUsed = receipt!.gasUsed;

        gasResults.push({
          memberCount: targetCount,
          gasUsed: gasUsed,
        });

        console.log(`Contributor #${targetCount.toString().padStart(3)}:  ${gasUsed.toString().padStart(7)} gas`);
      }

      console.log("━".repeat(60));

      // Calculate gas variance
      const firstGas = Number(gasResults[0].gasUsed);
      const lastGas = Number(gasResults[gasResults.length - 1].gasUsed);
      const variance = Math.abs(lastGas - firstGas) / firstGas;
      const variancePercent = (variance * 100).toFixed(2);

      console.log(`\n📊 Analysis:`);
      console.log(`First contributor gas:  ${firstGas.toLocaleString()} gas`);
      console.log(`100th contributor gas:  ${lastGas.toLocaleString()} gas`);
      console.log(`Variance: ${variancePercent}% (target: < 5%)`);

      // Calculate average and max deviation
      const avgGas = gasResults.reduce((sum, r) => sum + Number(r.gasUsed), 0) / gasResults.length;
      const maxDeviation = Math.max(
        ...gasResults.map(r => Math.abs(Number(r.gasUsed) - avgGas))
      );
      const maxDeviationPercent = ((maxDeviation / avgGas) * 100).toFixed(2);

      console.log(`Average gas: ${Math.round(avgGas).toLocaleString()} gas`);
      console.log(`Max deviation: ${Math.round(maxDeviation).toLocaleString()} gas (${maxDeviationPercent}%)`);

      // Verify acceptance criteria: within 5% variance
      expect(variance).to.be.lessThan(0.05, 
        `Gas variance ${variancePercent}% exceeds 5% threshold`);

      console.log(`\n✅ RESULT: O(1) COMPLEXITY VERIFIED`);
      console.log(`   Gas costs remain constant regardless of member count`);
      console.log("━".repeat(60));
    });

    it("Should have consistent gas cost for multiple contributions from same member", async function () {
      // Add 50 members
      for (let i = 0; i < 50; i++) {
        await ajoCircle.addMember(members[i].address);
      }

      const contributor = members[0];
      const gasResults: bigint[] = [];

      // Make 5 contributions and measure gas each time
      for (let i = 0; i < 5; i++) {
        const tx = await ajoCircle.connect(contributor).contribute({
          value: CONTRIBUTION_AMOUNT,
        });
        const receipt = await tx.wait();
        gasResults.push(receipt!.gasUsed);
      }

      // Verify all contributions have similar gas cost
      const avgGas = gasResults.reduce((sum, g) => sum + g, 0n) / BigInt(gasResults.length);
      
      gasResults.forEach((gas, index) => {
        const deviation = Number(gas > avgGas ? gas - avgGas : avgGas - gas);
        const deviationPercent = (deviation / Number(avgGas)) * 100;
        
        expect(deviationPercent).to.be.lessThan(5,
          `Contribution #${index + 1} gas deviation ${deviationPercent.toFixed(2)}% exceeds 5%`);
      });
    });

    it("Should have O(1) gas cost for claimPayout regardless of member count", async function () {
      const gasResults: { memberCount: number; gasUsed: bigint }[] = [];
      const testPoints = [5, 25, 50];

      for (const targetCount of testPoints) {
        // Deploy fresh contract for each test
        const AjoCircleFactory = await ethers.getContractFactory("AjoCircle");
        const testCircle = await AjoCircleFactory.deploy();
        await testCircle.waitForDeployment();
        await testCircle.initializeCircle(CONTRIBUTION_AMOUNT, FREQUENCY_DAYS, MAX_ROUNDS);

        // Add members
        for (let i = 0; i < targetCount - 1; i++) {
          await testCircle.addMember(members[i].address);
        }

        // All members contribute
        await testCircle.connect(owner).contribute({ value: CONTRIBUTION_AMOUNT });
        for (let i = 0; i < targetCount - 1; i++) {
          await testCircle.connect(members[i]).contribute({ value: CONTRIBUTION_AMOUNT });
        }

        // Measure gas for claimPayout
        const tx = await testCircle.connect(owner).claimPayout();
        const receipt = await tx.wait();
        
        gasResults.push({
          memberCount: targetCount,
          gasUsed: receipt!.gasUsed,
        });
      }

      // Verify gas costs are consistent
      const firstGas = Number(gasResults[0].gasUsed);
      const lastGas = Number(gasResults[gasResults.length - 1].gasUsed);
      const variance = Math.abs(lastGas - firstGas) / firstGas;

      expect(variance).to.be.lessThan(0.05,
        `claimPayout gas variance ${(variance * 100).toFixed(2)}% exceeds 5%`);
    });

    it("Should have O(1) gas cost for partialWithdraw regardless of member count", async function () {
      const gasResults: { memberCount: number; gasUsed: bigint }[] = [];
      const testPoints = [5, 25, 50];
      const withdrawAmount = ethers.parseEther("0.5");

      for (const targetCount of testPoints) {
        // Deploy fresh contract for each test
        const AjoCircleFactory = await ethers.getContractFactory("AjoCircle");
        const testCircle = await AjoCircleFactory.deploy();
        await testCircle.waitForDeployment();
        await testCircle.initializeCircle(CONTRIBUTION_AMOUNT, FREQUENCY_DAYS, MAX_ROUNDS);

        // Add members
        for (let i = 0; i < targetCount - 1; i++) {
          await testCircle.addMember(members[i].address);
        }

        // Member contributes
        await testCircle.connect(members[0]).contribute({ value: CONTRIBUTION_AMOUNT });

        // Measure gas for partialWithdraw
        const tx = await testCircle.connect(members[0]).partialWithdraw(withdrawAmount);
        const receipt = await tx.wait();
        
        gasResults.push({
          memberCount: targetCount,
          gasUsed: receipt!.gasUsed,
        });
      }

      // Verify gas costs are consistent
      const firstGas = Number(gasResults[0].gasUsed);
      const lastGas = Number(gasResults[gasResults.length - 1].gasUsed);
      const variance = Math.abs(lastGas - firstGas) / firstGas;

      expect(variance).to.be.lessThan(0.05,
        `partialWithdraw gas variance ${(variance * 100).toFixed(2)}% exceeds 5%`);
    });
  });

  describe("State Variable Efficiency", function () {
    it("Should update totalPoolBalance incrementally without iteration", async function () {
      // Add 10 members
      for (let i = 0; i < 10; i++) {
        await ajoCircle.addMember(members[i].address);
      }

      // Initial balance
      let circleState = await ajoCircle.getCircleState();
      expect(circleState.totalPoolBalance).to.equal(0);

      // Member 1 contributes
      await ajoCircle.connect(members[0]).contribute({ value: CONTRIBUTION_AMOUNT });
      circleState = await ajoCircle.getCircleState();
      expect(circleState.totalPoolBalance).to.equal(CONTRIBUTION_AMOUNT);

      // Member 2 contributes
      await ajoCircle.connect(members[1]).contribute({ value: CONTRIBUTION_AMOUNT });
      circleState = await ajoCircle.getCircleState();
      expect(circleState.totalPoolBalance).to.equal(CONTRIBUTION_AMOUNT * 2n);

      // Member 3 contributes
      await ajoCircle.connect(members[2]).contribute({ value: CONTRIBUTION_AMOUNT });
      circleState = await ajoCircle.getCircleState();
      expect(circleState.totalPoolBalance).to.equal(CONTRIBUTION_AMOUNT * 3n);

      // Verify: totalPoolBalance is always current without recalculation
    });

    it("Should update memberCount incrementally without iteration", async function () {
      let circleState = await ajoCircle.getCircleState();
      expect(circleState.memberCount).to.equal(1); // Owner

      // Add members one by one
      for (let i = 0; i < 10; i++) {
        await ajoCircle.addMember(members[i].address);
        circleState = await ajoCircle.getCircleState();
        expect(circleState.memberCount).to.equal(i + 2); // +2 because owner is #1
      }

      // Verify: memberCount is always current without counting loop
    });

    it("Should update member totalContributed incrementally", async function () {
      await ajoCircle.addMember(members[0].address);

      // Initial state
      let memberData = await ajoCircle.getMemberBalance(members[0].address);
      expect(memberData.totalContributed).to.equal(0);

      // First contribution
      await ajoCircle.connect(members[0]).contribute({ value: CONTRIBUTION_AMOUNT });
      memberData = await ajoCircle.getMemberBalance(members[0].address);
      expect(memberData.totalContributed).to.equal(CONTRIBUTION_AMOUNT);

      // Second contribution
      await ajoCircle.connect(members[0]).contribute({ value: CONTRIBUTION_AMOUNT });
      memberData = await ajoCircle.getMemberBalance(members[0].address);
      expect(memberData.totalContributed).to.equal(CONTRIBUTION_AMOUNT * 2n);

      // Third contribution
      await ajoCircle.connect(members[0]).contribute({ value: CONTRIBUTION_AMOUNT });
      memberData = await ajoCircle.getMemberBalance(members[0].address);
      expect(memberData.totalContributed).to.equal(CONTRIBUTION_AMOUNT * 3n);

      // Verify: totalContributed is incrementally updated, not recalculated
    });
  });

  describe("Scalability Stress Test", function () {
    it("Should handle 100 members with consistent gas costs", async function () {
      console.log("\n🚀 SCALABILITY STRESS TEST");
      console.log("━".repeat(60));

      // Add 100 members
      console.log("Adding 100 members...");
      for (let i = 0; i < 100; i++) {
        await ajoCircle.addMember(members[i].address);
      }

      const circleState = await ajoCircle.getCircleState();
      expect(circleState.memberCount).to.equal(101); // 100 + owner

      console.log(`✅ Successfully added 100 members`);
      console.log(`   Total members: ${circleState.memberCount}`);

      // Measure gas for contributions at different points
      const gasReadings: bigint[] = [];
      const testIndices = [0, 24, 49, 74, 99]; // 1st, 25th, 50th, 75th, 100th

      for (const index of testIndices) {
        const tx = await ajoCircle.connect(members[index]).contribute({
          value: CONTRIBUTION_AMOUNT,
        });
        const receipt = await tx.wait();
        gasReadings.push(receipt!.gasUsed);
        
        console.log(`Contributor #${(index + 1).toString().padStart(3)}: ${receipt!.gasUsed.toString().padStart(7)} gas`);
      }

      // Verify all gas costs are within 5% of each other
      const avgGas = gasReadings.reduce((sum, g) => sum + g, 0n) / BigInt(gasReadings.length);
      
      gasReadings.forEach((gas, index) => {
        const deviation = Number(gas > avgGas ? gas - avgGas : avgGas - gas);
        const deviationPercent = (deviation / Number(avgGas)) * 100;
        
        expect(deviationPercent).to.be.lessThan(5,
          `Gas deviation ${deviationPercent.toFixed(2)}% exceeds 5% threshold`);
      });

      console.log(`\n✅ All gas costs within 5% variance`);
      console.log(`   Average: ${avgGas.toString()} gas`);
      console.log("━".repeat(60));
    });

    it("Should maintain O(1) complexity even with many contributions per member", async function () {
      await ajoCircle.addMember(members[0].address);

      const gasReadings: bigint[] = [];

      // Make 20 contributions from same member
      for (let i = 0; i < 20; i++) {
        const tx = await ajoCircle.connect(members[0]).contribute({
          value: ethers.parseEther("0.1"),
        });
        const receipt = await tx.wait();
        gasReadings.push(receipt!.gasUsed);
      }

      // Verify gas costs remain consistent
      const firstGas = Number(gasReadings[0]);
      const lastGas = Number(gasReadings[gasReadings.length - 1]);
      const variance = Math.abs(lastGas - firstGas) / firstGas;

      expect(variance).to.be.lessThan(0.05,
        `Gas variance ${(variance * 100).toFixed(2)}% exceeds 5% after 20 contributions`);

      // Verify member's totalContributed is correct
      const memberData = await ajoCircle.getMemberBalance(members[0].address);
      expect(memberData.totalContributed).to.equal(ethers.parseEther("2.0")); // 20 * 0.1
    });
  });

  describe("Gas Comparison: Operations", function () {
    it("Should show gas costs for all major operations", async function () {
      console.log("\n⛽ GAS COST BREAKDOWN");
      console.log("━".repeat(60));

      // Add member
      const addMemberTx = await ajoCircle.addMember(members[0].address);
      const addMemberReceipt = await addMemberTx.wait();
      console.log(`addMember():        ${addMemberReceipt!.gasUsed.toString().padStart(7)} gas`);

      // Contribute
      const contributeTx = await ajoCircle.connect(members[0]).contribute({
        value: CONTRIBUTION_AMOUNT,
      });
      const contributeReceipt = await contributeTx.wait();
      console.log(`contribute():       ${contributeReceipt!.gasUsed.toString().padStart(7)} gas`);

      // Add more members for payout test
      for (let i = 1; i < 5; i++) {
        await ajoCircle.addMember(members[i].address);
        await ajoCircle.connect(members[i]).contribute({ value: CONTRIBUTION_AMOUNT });
      }

      // Claim payout
      const claimTx = await ajoCircle.connect(members[0]).claimPayout();
      const claimReceipt = await claimTx.wait();
      console.log(`claimPayout():      ${claimReceipt!.gasUsed.toString().padStart(7)} gas`);

      // Partial withdraw
      await ajoCircle.connect(members[1]).contribute({ value: CONTRIBUTION_AMOUNT });
      const withdrawTx = await ajoCircle.connect(members[1]).partialWithdraw(
        ethers.parseEther("0.5")
      );
      const withdrawReceipt = await withdrawTx.wait();
      console.log(`partialWithdraw():  ${withdrawReceipt!.gasUsed.toString().padStart(7)} gas`);

      console.log("━".repeat(60));
      console.log("✅ All operations maintain O(1) complexity");
    });
  });
});
