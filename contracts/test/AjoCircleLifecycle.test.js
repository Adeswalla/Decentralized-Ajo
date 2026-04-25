const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AjoCircle Integration - Full Lifecycle", function () {
  let ajoCircle;
  let owner, member1, member2;
  let priceFeedMock;
  const contributionUSD = ethers.utils.parseUnits("100", 8); // $100
  const frequencyDays = 7;
  const maxRounds = 2;
  const maxMembers = 3;
  let circleId;

  before(async function () {
    [owner, member1, member2] = await ethers.getSigners();

    // Deploy mock price feed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    priceFeedMock = await MockPriceFeed.deploy();
    await priceFeedMock.deployed();
    await priceFeedMock.setPrice(200000000000); // $2000/ETH

    // Deploy AjoCircle
    const AjoCircle = await ethers.getContractFactory("AjoCircle");
    ajoCircle = await AjoCircle.deploy(priceFeedMock.address);
    await ajoCircle.deployed();
  });

  it("Step 1: Creation - Should create a circle", async function () {
    const tx = await ajoCircle.createCircle(
      ethers.constants.AddressZero,
      contributionUSD,
      frequencyDays,
      maxRounds,
      maxMembers,
      false
    );
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "CircleCreated");
    circleId = event.args.circleId;
    expect(circleId).to.equal(0);
    
    const circle = await ajoCircle.getCircle(circleId);
    expect(circle.active).to.be.true;
    expect(circle.currentRound).to.equal(0);
  });

  it("Step 2: Membership - Should allow 3 members to join", async function () {
    // Organizer joins
    await ajoCircle.joinCircle(circleId);
    // Member 1 joins
    await ajoCircle.connect(member1).joinCircle(circleId);
    // Member 2 joins
    await ajoCircle.connect(member2).joinCircle(circleId);

    const members = await ajoCircle.getCircleMembers(circleId);
    expect(members.length).to.equal(3);
    
    const circle = await ajoCircle.getCircle(circleId);
    expect(circle.currentRound).to.equal(1); // Started after first join
  });

  it("Step 3: Round 1 - Full Cycle (Contributions -> Payouts)", async function () {
    const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
    const members = [owner, member1, member2];

    for (let i = 0; i < maxMembers; i++) {
      // 1. All members contribute for this payout
      for (const member of members) {
        await ajoCircle.connect(member).contributeETH(circleId, { value: requiredETH });
      }

      // 2. Check who's turn it is
      const payoutOrder = await ajoCircle.getPayoutOrder(circleId);
      const currentIdx = await ajoCircle.currentPayoutIndex(circleId);
      const beneficiaryAddress = payoutOrder[currentIdx];
      const beneficiary = await ethers.getSigner(beneficiaryAddress);

      // 3. Beneficiary claims payout
      const poolBefore = await ajoCircle.totalPool(circleId);
      expect(poolBefore).to.equal(requiredETH.mul(maxMembers));

      await ajoCircle.connect(beneficiary).claimPayout(circleId);

      // 4. Verify payout state
      const memberData = await ajoCircle.getMember(circleId, beneficiaryAddress);
      expect(memberData.hasReceivedPayout).to.be.true;
      expect(await ajoCircle.totalPool(circleId)).to.equal(0);
    }

    // After all 3 have claimed, round should advance to 2
    const circle = await ajoCircle.getCircle(circleId);
    expect(circle.currentRound).to.equal(2);
  });

  it("Step 4: Round 2 - Full Cycle with Price Changes and Closure", async function () {
    const members = [owner, member1, member2];

    for (let i = 0; i < maxMembers; i++) {
      // 1. Change price before contributions
      if (i === 1) {
        // Drop ETH price to $1000/ETH (was $2000)
        // $100 contribution should now be 0.1 ETH (was 0.05 ETH)
        await priceFeedMock.setPrice(100000000000);
      } else if (i === 2) {
        // Pump ETH price to $4000/ETH
        // $100 contribution should now be 0.025 ETH
        await priceFeedMock.setPrice(400000000000);
      }

      const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);

      // 2. All members contribute
      for (const member of members) {
        await ajoCircle.connect(member).contributeETH(circleId, { value: requiredETH });
      }

      // 3. Beneficiary claims
      const payoutOrder = await ajoCircle.getPayoutOrder(circleId);
      const currentIdx = await ajoCircle.currentPayoutIndex(circleId);
      const beneficiaryAddress = payoutOrder[currentIdx];
      const beneficiary = await ethers.getSigner(beneficiaryAddress);

      await ajoCircle.connect(beneficiary).claimPayout(circleId);
    }

    // After Round 2 finishes, circle.currentRound becomes 3, and active becomes false
    const circle = await ajoCircle.getCircle(circleId);
    expect(circle.currentRound).to.equal(3);
    expect(circle.active).to.be.false;
  });

  it("Step 5: Post-Closure - Should not allow contributions or joins", async function () {
    const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
    
    await expect(
      ajoCircle.connect(member1).contributeETH(circleId, { value: requiredETH })
    ).to.be.revertedWith("Circle not active");

    const [,, unknownMember] = await ethers.getSigners();
    // Assuming there's a 4th signer or just use a random address
    const randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    
    await expect(
      ajoCircle.connect(randomWallet).joinCircle(circleId)
    ).to.be.revertedWith("Circle not active");
  });
});
