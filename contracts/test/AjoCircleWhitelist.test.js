const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AjoCircle Whitelist", function () {
  let ajoCircle;
  let owner, member1, member2, member3;
  let priceFeedMock;
  const contributionUSD = ethers.utils.parseUnits("50", 8);
  const frequencyDays = 7;
  const maxRounds = 3;
  const maxMembers = 3;
  let circleId;

  beforeEach(async function () {
    [owner, member1, member2, member3] = await ethers.getSigners();

    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    priceFeedMock = await MockPriceFeed.deploy();
    await priceFeedMock.deployed();
    await priceFeedMock.setPrice(200000000000);

    const AjoCircle = await ethers.getContractFactory("AjoCircle");
    ajoCircle = await AjoCircle.deploy(priceFeedMock.address);
    await ajoCircle.deployed();

    // Create a private circle
    const tx = await ajoCircle.createCircle(
      ethers.constants.AddressZero,
      contributionUSD,
      frequencyDays,
      maxRounds,
      maxMembers,
      true // Private circle
    );
    const receipt = await tx.wait();
    circleId = receipt.events.find(e => e.event === "CircleCreated").args.circleId;
  });

  it("Should automatically whitelist the organizer", async function () {
    expect(await ajoCircle.isWhitelisted(circleId, owner.address)).to.be.true;
    // Organizer should be able to join
    await expect(ajoCircle.joinCircle(circleId)).to.not.be.reverted;
  });

  it("Should prevent non-whitelisted addresses from joining", async function () {
    await expect(
      ajoCircle.connect(member1).joinCircle(circleId)
    ).to.be.revertedWith("NotWhitelisted");
  });

  it("Should allow organizer to add addresses to whitelist", async function () {
    await ajoCircle.addToWhitelist(circleId, member1.address);
    expect(await ajoCircle.isWhitelisted(circleId, member1.address)).to.be.true;
    
    // Now member1 can join
    await expect(ajoCircle.connect(member1).joinCircle(circleId)).to.not.be.reverted;
  });

  it("Should allow organizer to batch add addresses", async function () {
    await ajoCircle.batchAddToWhitelist(circleId, [member1.address, member2.address]);
    
    expect(await ajoCircle.isWhitelisted(circleId, member1.address)).to.be.true;
    expect(await ajoCircle.isWhitelisted(circleId, member2.address)).to.be.true;
    
    await expect(ajoCircle.connect(member1).joinCircle(circleId)).to.not.be.reverted;
    await expect(ajoCircle.connect(member2).joinCircle(circleId)).to.not.be.reverted;
  });

  it("Should allow organizer to remove addresses from whitelist", async function () {
    await ajoCircle.addToWhitelist(circleId, member1.address);
    await ajoCircle.removeFromWhitelist(circleId, member1.address);
    
    expect(await ajoCircle.isWhitelisted(circleId, member1.address)).to.be.false;
    
    await expect(
      ajoCircle.connect(member1).joinCircle(circleId)
    ).to.be.revertedWith("NotWhitelisted");
  });

  it("Should prevent non-organizers from managing whitelist", async function () {
    await expect(
      ajoCircle.connect(member1).addToWhitelist(circleId, member2.address)
    ).to.be.revertedWith("Only organizer can whitelist");
  });

  it("Should not enforce whitelist for public circles", async function () {
    const tx = await ajoCircle.createCircle(
      ethers.constants.AddressZero,
      contributionUSD,
      frequencyDays,
      maxRounds,
      maxMembers,
      false // Public circle
    );
    const receipt = await tx.wait();
    const publicCircleId = receipt.events.find(e => e.event === "CircleCreated").args.circleId;

    // Anyone can join public circle without being whitelisted
    await expect(ajoCircle.connect(member1).joinCircle(publicCircleId)).to.not.be.reverted;
  });
});
