import { ethers } from "hardhat";
import { expect } from "chai";
import { AjoFactory } from "../typechain-types";

describe("AjoFactory", function () {
  let ajoFactory: AjoFactory;
  let owner: any;
  let addr1: any;
  let addr2: any;

  // Constants for testing
  const CONTRIBUTION_AMOUNT = ethers.parseEther("1");
  const FREQUENCY = 30 * 24 * 60 * 60; // 30 days in seconds

  beforeEach(async function () {
    // Deploy fresh instance for each test
    const [ownerAccount, account1, account2] = await ethers.getSigners();
    owner = ownerAccount;
    addr1 = account1;
    addr2 = account2;

    const AjoFactoryContract = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactoryContract.deploy();
    await ajoFactory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const address = await ajoFactory.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set platform owner to deployer", async function () {
      expect(await ajoFactory.platformOwner()).to.equal(owner.address);
    });

    it("Should initialize platform fee to 1%", async function () {
      expect(await ajoFactory.platformFee()).to.equal(100);
    });
  });

  describe("Circle Creation", function () {
    it("Should create a circle successfully", async function () {
      const tx = await ajoFactory.createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        FREQUENCY
      );

      await expect(tx)
        .to.emit(ajoFactory, "CircleCreated")
        .withArgs(0, "Test Circle", owner.address, CONTRIBUTION_AMOUNT, FREQUENCY);

      const circle = await ajoFactory.getCircle(0);
      expect(circle.name).to.equal("Test Circle");
      expect(circle.creator).to.equal(owner.address);
      expect(circle.status).to.equal(0); // PENDING
    });

    it("Should revert if contribution amount is 0", async function () {
      await expect(
        ajoFactory.createCircle("Test Circle", 0, FREQUENCY)
      ).to.be.revertedWith("AjoFactory: Contribution amount must be greater than 0");
    });

    it("Should revert if frequency is 0", async function () {
      await expect(
        ajoFactory.createCircle("Test Circle", CONTRIBUTION_AMOUNT, 0)
      ).to.be.revertedWith("AjoFactory: Frequency must be greater than 0");
    });

    it("Should revert if name is empty", async function () {
      await expect(
        ajoFactory.createCircle("", CONTRIBUTION_AMOUNT, FREQUENCY)
      ).to.be.revertedWith("AjoFactory: Name cannot be empty");
    });
  });

  describe("Circle Membership", function () {
    beforeEach(async function () {
      await ajoFactory.createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        FREQUENCY
      );
    });

    it("Should allow joining a circle", async function () {
      await expect(ajoFactory.connect(addr1).joinCircle(0))
        .to.emit(ajoFactory, "MemberJoined")
        .withArgs(0, addr1.address);

      expect(await ajoFactory.isMember(0, addr1.address)).to.be.true;
    });

    it("Should activate circle when 2 members join", async function () {
      await ajoFactory.connect(addr1).joinCircle(0);

      const tx = await ajoFactory.connect(addr2).joinCircle(0);
      
      await expect(tx)
        .to.emit(ajoFactory, "CircleStatusChanged")
        .withArgs(0, 1); // ACTIVE status

      const circle = await ajoFactory.getCircle(0);
      expect(circle.status).to.equal(1); // ACTIVE
    });

    it("Should prevent duplicate membership", async function () {
      await ajoFactory.connect(addr1).joinCircle(0);

      await expect(
        ajoFactory.connect(addr1).joinCircle(0)
      ).to.be.revertedWith("AjoFactory: Already a member of this circle");
    });

    it("Should return all members", async function () {
      await ajoFactory.connect(addr1).joinCircle(0);
      const members = await ajoFactory.getCircleMembers(0);

      expect(members.length).to.equal(2);
      expect(members).to.include(owner.address);
      expect(members).to.include(addr1.address);
    });
  });

  describe("Contributions", function () {
    beforeEach(async function () {
      await ajoFactory.createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        FREQUENCY
      );
      await ajoFactory.connect(addr1).joinCircle(0);
      await ajoFactory.connect(addr2).joinCircle(0);
    });

    it("Should accept contribution", async function () {
      const tx = await ajoFactory
        .connect(addr1)
        .contributeToCircle(0, { value: CONTRIBUTION_AMOUNT });

      await expect(tx)
        .to.emit(ajoFactory, "ContributionReceived")
        .withArgs(0, addr1.address, CONTRIBUTION_AMOUNT);
    });

    it("Should reject incorrect contribution amount", async function () {
      const wrongAmount = ethers.parseEther("2");
      await expect(
        ajoFactory
          .connect(addr1)
          .contributeToCircle(0, { value: wrongAmount })
      ).to.be.revertedWith("AjoFactory: Incorrect contribution amount");
    });

    it("Should reject contribution from non-member", async function () {
      const [, , , nonMember] = await ethers.getSigners();
      await expect(
        ajoFactory
          .connect(nonMember)
          .contributeToCircle(0, { value: CONTRIBUTION_AMOUNT })
      ).to.be.revertedWith("AjoFactory: Not a member of this circle");
    });
  });

  describe("Platform Management", function () {
    it("Should update platform fee", async function () {
      const newFee = 200; // 2%
      await expect(ajoFactory.setPlatformFee(newFee))
        .to.emit(ajoFactory, "PlatformFeeUpdated")
        .withArgs(newFee);

      expect(await ajoFactory.platformFee()).to.equal(newFee);
    });

    it("Should reject fee > 100%", async function () {
      await expect(ajoFactory.setPlatformFee(10001)).to.be.revertedWith(
        "AjoFactory: Fee cannot exceed 100%"
      );
    });

    it("Should transfer platform ownership", async function () {
      await expect(ajoFactory.transferPlatformOwnership(addr1.address))
        .to.emit(ajoFactory, "PlatformOwnerUpdated")
        .withArgs(addr1.address);

      expect(await ajoFactory.platformOwner()).to.equal(addr1.address);
    });

    it("Should reject transfer to zero address", async function () {
      await expect(
        ajoFactory.transferPlatformOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("AjoFactory: Invalid address");
    });
  });

  describe("Circle Cancellation", function () {
    beforeEach(async function () {
      await ajoFactory.createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        FREQUENCY
      );
    });

    it("Should allow creator to cancel circle", async function () {
      await expect(ajoFactory.cancelCircle(0))
        .to.emit(ajoFactory, "CircleStatusChanged")
        .withArgs(0, 3); // CANCELLED status

      const circle = await ajoFactory.getCircle(0);
      expect(circle.status).to.equal(3); // CANCELLED
    });

    it("Should prevent non-creator from cancelling", async function () {
      await expect(ajoFactory.connect(addr1).cancelCircle(0)).to.be.revertedWith(
        "AjoFactory: Only circle creator can call this"
      );
    });
  });

  describe("User Circles Query", function () {
    it("Should return all circles for a user", async function () {
      await ajoFactory.createCircle(
        "Circle 1",
        CONTRIBUTION_AMOUNT,
        FREQUENCY
      );
      await ajoFactory.createCircle(
        "Circle 2",
        CONTRIBUTION_AMOUNT,
        FREQUENCY
      );

      const userCircles = await ajoFactory.getUserCircles(owner.address);
      expect(userCircles.length).to.equal(2);
      expect(userCircles).to.include(0n);
      expect(userCircles).to.include(1n);
    });
  });
});
