import { expect } from "chai";
import { ethers } from "hardhat";
import { DecentralizedAjo } from "../typechain-types";

describe("DecentralizedAjo", () => {
  let ajo: DecentralizedAjo;
  let members: string[];
  const contribution = ethers.parseEther("1");

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    members = signers.slice(0, 3).map((s) => s.address);

    const Factory = await ethers.getContractFactory("DecentralizedAjo");
    ajo = (await Factory.deploy(members, contribution)) as DecentralizedAjo;
    await ajo.waitForDeployment();
  });

  it("deploys with correct initial state", async () => {
    expect(await ajo.currentCycle()).to.equal(1n);
    expect(await ajo.totalPool()).to.equal(0n);
    expect(await ajo.contributionAmount()).to.equal(contribution);
  });

  it("accepts contributions via receive()", async () => {
    const signers = await ethers.getSigners();
    const required = contribution * BigInt(members.length);

    for (const signer of signers.slice(0, 3)) {
      await signer.sendTransaction({ to: await ajo.getAddress(), value: contribution });
    }

    expect(await ajo.totalPool()).to.equal(required);
  });

  it("allows the correct member to withdraw when pool is full", async () => {
    const signers = await ethers.getSigners();
    const required = contribution * BigInt(members.length);

    for (const signer of signers.slice(0, 3)) {
      await signer.sendTransaction({ to: await ajo.getAddress(), value: contribution });
    }

    const receiver = signers[0]; // cycle 1 → members[0]
    await expect(ajo.connect(receiver).withdraw())
      .to.emit(ajo, "CycleCompleted")
      .withArgs(receiver.address, 1n, required);

    expect(await ajo.currentCycle()).to.equal(2n);
    expect(await ajo.totalPool()).to.equal(0n);
  });

  it("reverts with UnauthorizedCycle if wrong member calls withdraw", async () => {
    const signers = await ethers.getSigners();
    for (const signer of signers.slice(0, 3)) {
      await signer.sendTransaction({ to: await ajo.getAddress(), value: contribution });
    }

    // signers[1] is not the cycle-1 receiver
    await expect(ajo.connect(signers[1]).withdraw()).to.be.revertedWithCustomError(
      ajo,
      "UnauthorizedCycle"
    );
  });

  it("reverts with PoolIncomplete if pool is not full", async () => {
    const signers = await ethers.getSigners();
    // Only one contribution instead of three
    await signers[0].sendTransaction({ to: await ajo.getAddress(), value: contribution });

    await expect(ajo.connect(signers[0]).withdraw()).to.be.revertedWithCustomError(
      ajo,
      "PoolIncomplete"
    );
  });

  it("reverts with CycleExceeded after all cycles complete", async () => {
    const signers = await ethers.getSigners();
    const required = contribution * BigInt(members.length);

    // Complete all 3 cycles
    for (let cycle = 0; cycle < members.length; cycle++) {
      for (const signer of signers.slice(0, 3)) {
        await signer.sendTransaction({ to: await ajo.getAddress(), value: contribution });
      }
      await ajo.connect(signers[cycle]).withdraw();
    }

    // Fund again and try a 4th withdrawal
    for (const signer of signers.slice(0, 3)) {
      await signer.sendTransaction({ to: await ajo.getAddress(), value: contribution });
    }

    await expect(ajo.connect(signers[0]).withdraw()).to.be.revertedWithCustomError(
      ajo,
      "CycleExceeded"
    );
  });
});
