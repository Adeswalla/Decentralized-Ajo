const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AjoCircle", function () {
  let ajoCircle;
  let owner;
  let member1;
  let member2;
  let member3;
  let priceFeedMock;

  // Mock price feed for testing
  beforeEach(async function () {
    [owner, member1, member2, member3] = await ethers.getSigners();

    // Deploy mock price feed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    priceFeedMock = await MockPriceFeed.deploy();
    await priceFeedMock.deployed();

    // Set mock price to $2000 ETH (8 decimals: 200000000000)
    await priceFeedMock.setPrice(200000000000);

    // Deploy AjoCircle with mock price feed
    const AjoCircle = await ethers.getContractFactory("AjoCircle");
    ajoCircle = await AjoCircle.deploy(priceFeedMock.address);
    await ajoCircle.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await ajoCircle.owner()).to.equal(owner.address);
    });

    it("Should set the correct price feed", async function () {
      const latestPrice = await ajoCircle.getLatestETHUSDPrice();
      expect(latestPrice).to.equal(200000000000);
    });
  });

  describe("Price Feed Functions", function () {
    it("Should convert USD to ETH correctly", async function () {
      // $100 USD should equal 0.05 ETH at $2000/ETH
      const usdAmount = ethers.utils.parseUnits("100", 8); // 100 USD with 8 decimals
      const ethAmount = await ajoCircle.usdToEth(usdAmount);
      
      // 0.05 ETH = 50000000000000000 wei
      const expectedEth = ethers.utils.parseEther("0.05");
      expect(ethAmount).to.equal(expectedEth);
    });

    it("Should convert ETH to USD correctly", async function () {
      // 0.05 ETH should equal $100 USD at $2000/ETH
      const ethAmount = ethers.utils.parseEther("0.05");
      const usdAmount = await ajoCircle.ethToUsd(ethAmount);
      
      // $100 USD with 8 decimals
      const expectedUsd = ethers.utils.parseUnits("100", 8);
      expect(usdAmount).to.equal(expectedUsd);
    });

    it("Should revert with invalid price", async function () {
      await priceFeedMock.setPrice(0);
      await expect(ajoCircle.getLatestETHUSDPrice()).to.be.revertedWith("PriceFeedUnavailable");
    });
  });

  describe("Circle Creation", function () {
    it("Should create a circle successfully", async function () {
      const contributionAmountUSD = ethers.utils.parseUnits("50", 8); // $50 USD
      
      const tx = await ajoCircle.createCircle(
        ethers.constants.AddressZero, // ETH contributions
        contributionAmountUSD,
        7, // 7 days frequency
        12, // 12 rounds
        5 // 5 members
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "CircleCreated");
      
      expect(event.args.circleId).to.equal(0);
      expect(event.args.organizer).to.equal(owner.address);
      expect(event.args.contributionAmountUSD).to.equal(contributionAmountUSD);
      expect(event.args.maxMembers).to.equal(5);
      expect(event.args.maxRounds).to.equal(12);
      expect(event.args.frequencyDays).to.equal(7);
    });

    it("Should fail with invalid parameters", async function () {
      const contributionAmountUSD = ethers.utils.parseUnits("50", 8);
      
      await expect(
        ajoCircle.createCircle(
          ethers.constants.AddressZero,
          0, // Invalid amount
          7,
          12,
          5
        )
      ).to.be.revertedWith("Invalid contribution amount");

      await expect(
        ajoCircle.createCircle(
          ethers.constants.AddressZero,
          contributionAmountUSD,
          0, // Invalid frequency
          12,
          5
        )
      ).to.be.revertedWith("Invalid frequency");
    });
  });

  describe("Circle Membership", function () {
    let circleId;
    const contributionAmountUSD = ethers.utils.parseUnits("50", 8);

    beforeEach(async function () {
      const tx = await ajoCircle.createCircle(
        ethers.constants.AddressZero,
        contributionAmountUSD,
        7,
        12,
        3
      );
      const receipt = await tx.wait();
      circleId = receipt.events.find(e => e.event === "CircleCreated").args.circleId;
    });

    it("Should allow members to join the circle", async function () {
      await ajoCircle.connect(member1).joinCircle(circleId);
      
      const members = await ajoCircle.getCircleMembers(circleId);
      expect(members.length).to.equal(2); // Owner + member1
      expect(members[1]).to.equal(member1.address);
    });

    it("Should prevent duplicate membership", async function () {
      await ajoCircle.connect(member1).joinCircle(circleId);
      
      await expect(
        ajoCircle.connect(member1).joinCircle(circleId)
      ).to.be.revertedWith("Already a member");
    });

    it("Should prevent joining when circle is full", async function () {
      await ajoCircle.connect(member1).joinCircle(circleId);
      await ajoCircle.connect(member2).joinCircle(circleId);
      
      await expect(
        ajoCircle.connect(member3).joinCircle(circleId)
      ).to.be.revertedWith("Circle at capacity");
    });
  });

  describe("Contributions", function () {
    let circleId;
    const contributionAmountUSD = ethers.utils.parseUnits("50", 8);

    beforeEach(async function () {
      const tx = await ajoCircle.createCircle(
        ethers.constants.AddressZero,
        contributionAmountUSD,
        7,
        12,
        3
      );
      const receipt = await tx.wait();
      circleId = receipt.events.find(e => e.event === "CircleCreated").args.circleId;
      
      await ajoCircle.connect(member1).joinCircle(circleId);
      await ajoCircle.connect(member2).joinCircle(circleId);
    });

    it("Should accept ETH contributions with correct amount", async function () {
      const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
      
      const tx = await ajoCircle.connect(member1).contributeETH(circleId, {
        value: requiredETH
      });
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ContributionMade");
      
      expect(event.args.member).to.equal(member1.address);
      expect(event.args.amount).to.equal(requiredETH);
      
      const member = await ajoCircle.getMember(circleId, member1.address);
      expect(member.totalContributed).to.equal(requiredETH);
    });

    it("Should reject incorrect ETH amounts", async function () {
      const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
      
      await expect(
        ajoCircle.connect(member1).contributeETH(circleId, {
          value: requiredETH.add(1) // 1 wei extra
        })
      ).to.be.revertedWith("Incorrect ETH amount");
    });

    it("Should track total pool correctly", async function () {
      const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
      
      await ajoCircle.connect(member1).contributeETH(circleId, {
        value: requiredETH
      });
      
      let totalPool = await ajoCircle.totalPool(circleId);
      expect(totalPool).to.equal(requiredETH);
      
      await ajoCircle.connect(member2).contributeETH(circleId, {
        value: requiredETH
      });
      
      totalPool = await ajoCircle.totalPool(circleId);
      expect(totalPool).to.equal(requiredETH.mul(2));
    });
  });

  describe("Payouts", function () {
    let circleId;
    const contributionAmountUSD = ethers.utils.parseUnits("50", 8);

    beforeEach(async function () {
      const tx = await ajoCircle.createCircle(
        ethers.constants.AddressZero,
        contributionAmountUSD,
        7,
        12,
        3
      );
      const receipt = await tx.wait();
      circleId = receipt.events.find(e => e.event === "CircleCreated").args.circleId;
      
      await ajoCircle.connect(member1).joinCircle(circleId);
      await ajoCircle.connect(member2).joinCircle(circleId);
      
      // Make contributions
      const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
      await ajoCircle.contributeETH(circleId, { value: requiredETH });
      await ajoCircle.connect(member1).contributeETH(circleId, { value: requiredETH });
      await ajoCircle.connect(member2).contributeETH(circleId, { value: requiredETH });
    });

    it("Should allow first member in payout order to claim", async function () {
      const payoutOrder = await ajoCircle.getPayoutOrder(circleId);
      const firstMember = payoutOrder[0];
      
      const initialBalance = await ethers.provider.getBalance(firstMember);
      const totalPool = await ajoCircle.totalPool(circleId);
      
      const tx = await ajoCircle.connect(
        await ethers.getSigner(firstMember)
      ).claimPayout(circleId);
      
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const finalBalance = await ethers.provider.getBalance(firstMember);
      
      expect(finalBalance).to.equal(initialBalance.add(totalPool).sub(gasUsed));
      
      const member = await ajoCircle.getMember(circleId, firstMember);
      expect(member.hasReceivedPayout).to.be.true;
    });

    it("Should prevent members from claiming out of turn", async function () {
      const payoutOrder = await ajoCircle.getPayoutOrder(circleId);
      const secondMember = payoutOrder[1];
      
      await expect(
        ajoCircle.connect(await ethers.getSigner(secondMember)).claimPayout(circleId)
      ).to.be.revertedWith("Not your turn");
    });

    it("Should prevent double claiming", async function () {
      const payoutOrder = await ajoCircle.getPayoutOrder(circleId);
      const firstMember = payoutOrder[0];
      
      await ajoCircle.connect(await ethers.getSigner(firstMember)).claimPayout(circleId);
      
      await expect(
        ajoCircle.connect(await ethers.getSigner(firstMember)).claimPayout(circleId)
      ).to.be.revertedWith("Already received payout");
    });
  });
});
