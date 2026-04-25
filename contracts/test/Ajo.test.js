const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ajo", function () {
  let ajo;
  let owner;
  let member1;
  let member2;
  let contributionAmount;
  let cycleDuration;
  let maxMembers;

  beforeEach(async function () {
    [owner, member1, member2] = await ethers.getSigners();

    contributionAmount = ethers.utils.parseEther("1"); // 1 ETH
    cycleDuration = 30 * 24 * 60 * 60; // 30 days
    maxMembers = 10;

    const Ajo = await ethers.getContractFactory("Ajo");
    ajo = await Ajo.deploy(contributionAmount, cycleDuration, maxMembers);
    await ajo.deployed();
  });

  describe("Deployment", function () {
    it("Should set the correct contribution amount", async function () {
      expect(await ajo.contributionAmount()).to.equal(contributionAmount);
    });

    it("Should set the correct cycle duration", async function () {
      expect(await ajo.cycleDuration()).to.equal(cycleDuration);
    });

    it("Should set the correct max members", async function () {
      expect(await ajo.maxMembers()).to.equal(maxMembers);
    });
  });

  describe("Deposit", function () {
    it("Should revert if deposit amount is not equal to contribution amount", async function () {
      await expect(
        ajo.connect(member1).deposit({ value: ethers.utils.parseEther("0.5") })
      ).to.be.revertedWithCustomError(ajo, "InvalidContribution");
    });

    it("Should allow valid deposit and add new member", async function () {
      await expect(
        ajo.connect(member1).deposit({ value: contributionAmount })
      ).to.emit(ajo, "Deposited").withArgs(member1.address, contributionAmount);

      expect(await ajo.balances(member1.address)).to.equal(contributionAmount);
      expect(await ajo.totalPool()).to.equal(contributionAmount);
      expect(await ajo.members(0)).to.equal(member1.address);
      expect(await ajo.members.length).to.equal(1);
    });

    it("Should not add member if already exists", async function () {
      await ajo.connect(member1).deposit({ value: contributionAmount });
      await ajo.connect(member1).deposit({ value: contributionAmount });

      expect(await ajo.members.length).to.equal(1);
      expect(await ajo.balances(member1.address)).to.equal(contributionAmount.mul(2));
    });

    it("Should revert if pool is full", async function () {
      // Deploy with maxMembers = 1
      const AjoSmall = await ethers.getContractFactory("Ajo");
      const ajoSmall = await AjoSmall.deploy(contributionAmount, cycleDuration, 1);
      await ajoSmall.deployed();

      await ajoSmall.connect(member1).deposit({ value: contributionAmount });

      await expect(
        ajoSmall.connect(member2).deposit({ value: contributionAmount })
      ).to.be.revertedWithCustomError(ajoSmall, "AjoIsFull");
    });
  });
});