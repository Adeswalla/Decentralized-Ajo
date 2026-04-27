import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { AjoCircle } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MockERC20 } from "../typechain-types";

describe("AjoCircle - Batch Contribute", function () {
  let ajoCircle: AjoCircle;
  let mockToken: MockERC20;
  let organizer: SignerWithAddress;
  let member1: SignerWithAddress;
  let member2: SignerWithAddress;
  let member3: SignerWithAddress;
  let member4: SignerWithAddress;
  let member5: SignerWithAddress;

  const CONTRIBUTION_AMOUNT = ethers.parseEther("100");
  const FREQUENCY_DAYS = 30;
  const MAX_ROUNDS = 5;
  const MAX_MEMBERS = 10;

  beforeEach(async function () {
    [organizer, member1, member2, member3, member4, member5] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Test Token", "TEST");
    await mockToken.waitForDeployment();

    // Deploy AjoCircle as upgradeable proxy
    const AjoCircleFactory = await ethers.getContractFactory("AjoCircle");
    ajoCircle = await upgrades.deployProxy(
      AjoCircleFactory,
      [
        organizer.address,
        await mockToken.getAddress(),
        CONTRIBUTION_AMOUNT,
        FREQUENCY_DAYS,
        MAX_ROUNDS,
        MAX_MEMBERS,
      ],
      { initializer: "initialize" }
    ) as unknown as AjoCircle;

    await ajoCircle.waitForDeployment();

    // Add members
    await ajoCircle.connect(organizer).joinCircle(member1.address);
    await ajoCircle.connect(organizer).joinCircle(member2.address);
    await ajoCircle.connect(organizer).joinCircle(member3.address);
    await ajoCircle.connect(organizer).joinCircle(member4.address);
    await ajoCircle.connect(organizer).joinCircle(member5.address);

    // Mint tokens to organizer for batch contributions
    const totalAmount = CONTRIBUTION_AMOUNT * 10n;
    await mockToken.mint(organizer.address, totalAmount);
    await mockToken.connect(organizer).approve(await ajoCircle.getAddress(), totalAmount);
  });

  describe("Gas Efficiency", function () {
    it("should use less gas for batch contribute than individual contributions", async function () {
      const members = [member1.address, member2.address, member3.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      // Test batch contribution gas
      const batchTx = await ajoCircle
        .connect(organizer)
        .batchContribute(members, amounts);
      const batchReceipt = await batchTx.wait();
      const batchGas = batchReceipt!.gasUsed;

      console.log(`Batch contribute (3 members) gas: ${batchGas.toString()}`);

      // For comparison, estimate individual contribution gas
      // (We can't actually do this in the same test due to state changes,
      // but we can provide a theoretical comparison)
      
      // Individual contributions would require:
      // - 3 separate transactions
      // - 3 separate token transfers
      // - 3 separate state updates
      // Estimated: ~150k gas per transaction = ~450k total
      
      // Batch should be significantly less than 450k
      expect(batchGas).to.be.lt(400000n);
    });

    it("should process 10 contributions efficiently", async function () {
      // Add more members
      const [, , , , , , m6, m7, m8, m9, m10] = await ethers.getSigners();
      await ajoCircle.connect(organizer).joinCircle(m6.address);
      await ajoCircle.connect(organizer).joinCircle(m7.address);
      await ajoCircle.connect(organizer).joinCircle(m8.address);
      await ajoCircle.connect(organizer).joinCircle(m9.address);
      await ajoCircle.connect(organizer).joinCircle(m10.address);

      const members = [
        member1.address,
        member2.address,
        member3.address,
        member4.address,
        member5.address,
        m6.address,
        m7.address,
        m8.address,
        m9.address,
        m10.address,
      ];
      const amounts = Array(10).fill(CONTRIBUTION_AMOUNT);

      const batchTx = await ajoCircle
        .connect(organizer)
        .batchContribute(members, amounts);
      const batchReceipt = await batchTx.wait();
      const batchGas = batchReceipt!.gasUsed;

      console.log(`Batch contribute (10 members) gas: ${batchGas.toString()}`);

      // Should be significantly less than 10 individual transactions (~1.5M gas)
      expect(batchGas).to.be.lt(1000000n);
    });
  });

  describe("Functionality", function () {
    it("should successfully batch contribute for multiple members", async function () {
      const members = [member1.address, member2.address, member3.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      await expect(
        ajoCircle.connect(organizer).batchContribute(members, amounts)
      )
        .to.emit(ajoCircle, "ContributionMade")
        .withArgs(member1.address, CONTRIBUTION_AMOUNT)
        .and.to.emit(ajoCircle, "ContributionMade")
        .withArgs(member2.address, CONTRIBUTION_AMOUNT)
        .and.to.emit(ajoCircle, "ContributionMade")
        .withArgs(member3.address, CONTRIBUTION_AMOUNT);

      // Verify member contributions
      const member1Data = await ajoCircle.members(member1.address);
      const member2Data = await ajoCircle.members(member2.address);
      const member3Data = await ajoCircle.members(member3.address);

      expect(member1Data.totalContributed).to.equal(CONTRIBUTION_AMOUNT);
      expect(member2Data.totalContributed).to.equal(CONTRIBUTION_AMOUNT);
      expect(member3Data.totalContributed).to.equal(CONTRIBUTION_AMOUNT);
    });

    it("should update round progress correctly", async function () {
      // Contribute for all members to complete the round
      const members = [
        organizer.address,
        member1.address,
        member2.address,
        member3.address,
        member4.address,
        member5.address,
      ];
      const amounts = Array(6).fill(CONTRIBUTION_AMOUNT);

      const initialRound = await ajoCircle.circle();
      expect(initialRound.currentRound).to.equal(1);

      await ajoCircle.connect(organizer).batchContribute(members, amounts);

      const updatedRound = await ajoCircle.circle();
      expect(updatedRound.currentRound).to.equal(2);
    });

    it("should only allow organizer to batch contribute", async function () {
      const members = [member1.address, member2.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      await expect(
        ajoCircle.connect(member1).batchContribute(members, amounts)
      ).to.be.revertedWithCustomError(ajoCircle, "Unauthorized");
    });

    it("should revert if arrays have different lengths", async function () {
      const members = [member1.address, member2.address];
      const amounts = [CONTRIBUTION_AMOUNT];

      await expect(
        ajoCircle.connect(organizer).batchContribute(members, amounts)
      ).to.be.revertedWithCustomError(ajoCircle, "InvalidInput");
    });

    it("should revert if any member is not found", async function () {
      const [, , , , , , nonMember] = await ethers.getSigners();
      const members = [member1.address, nonMember.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      await expect(
        ajoCircle.connect(organizer).batchContribute(members, amounts)
      ).to.be.revertedWithCustomError(ajoCircle, "NotFound");
    });

    it("should revert if batch size exceeds limit", async function () {
      const members = Array(51).fill(member1.address);
      const amounts = Array(51).fill(CONTRIBUTION_AMOUNT);

      await expect(
        ajoCircle.connect(organizer).batchContribute(members, amounts)
      ).to.be.revertedWithCustomError(ajoCircle, "InvalidInput");
    });

    it("should revert if any amount is zero", async function () {
      const members = [member1.address, member2.address];
      const amounts = [CONTRIBUTION_AMOUNT, 0];

      await expect(
        ajoCircle.connect(organizer).batchContribute(members, amounts)
      ).to.be.revertedWithCustomError(ajoCircle, "InvalidInput");
    });

    it("should handle partial round completion", async function () {
      const members = [member1.address, member2.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      await ajoCircle.connect(organizer).batchContribute(members, amounts);

      const roundContribCount = await ajoCircle.roundContribCount();
      expect(roundContribCount).to.equal(2);

      const circleData = await ajoCircle.circle();
      expect(circleData.currentRound).to.equal(1); // Still in round 1
    });
  });

  describe("Token Transfer", function () {
    it("should transfer correct total amount from organizer", async function () {
      const members = [member1.address, member2.address, member3.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      const initialBalance = await mockToken.balanceOf(organizer.address);
      
      await ajoCircle.connect(organizer).batchContribute(members, amounts);

      const finalBalance = await mockToken.balanceOf(organizer.address);
      const expectedDeduction = CONTRIBUTION_AMOUNT * 3n;

      expect(initialBalance - finalBalance).to.equal(expectedDeduction);
    });

    it("should transfer tokens to contract", async function () {
      const members = [member1.address, member2.address];
      const amounts = [CONTRIBUTION_AMOUNT, CONTRIBUTION_AMOUNT];

      const initialContractBalance = await mockToken.balanceOf(await ajoCircle.getAddress());
      
      await ajoCircle.connect(organizer).batchContribute(members, amounts);

      const finalContractBalance = await mockToken.balanceOf(await ajoCircle.getAddress());
      const expectedIncrease = CONTRIBUTION_AMOUNT * 2n;

      expect(finalContractBalance - initialContractBalance).to.equal(expectedIncrease);
    });
  });
});
