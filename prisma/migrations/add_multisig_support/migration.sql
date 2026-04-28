-- Add multisig support for high-value withdrawals

-- Create table to track withdrawal approvals
CREATE TABLE "WithdrawalApproval" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalApproval_pkey" PRIMARY KEY ("id")
);

-- Add multisig configuration to Circle
ALTER TABLE "Circle" ADD COLUMN "multisigEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Circle" ADD COLUMN "multisigThreshold" FLOAT NOT NULL DEFAULT 0;
ALTER TABLE "Circle" ADD COLUMN "requiredApprovals" INTEGER NOT NULL DEFAULT 2;

-- Add approvers tracking to Circle (JSON array of user IDs)
ALTER TABLE "Circle" ADD COLUMN "approvers" TEXT;

-- Create indexes
CREATE INDEX "WithdrawalApproval_withdrawalId_idx" ON "WithdrawalApproval"("withdrawalId");
CREATE INDEX "WithdrawalApproval_approverId_idx" ON "WithdrawalApproval"("approverId");
CREATE UNIQUE INDEX "WithdrawalApproval_withdrawalId_approverId_key" ON "WithdrawalApproval"("withdrawalId", "approverId");

-- Add foreign keys
ALTER TABLE "WithdrawalApproval" ADD CONSTRAINT "WithdrawalApproval_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WithdrawalApproval" ADD CONSTRAINT "WithdrawalApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
