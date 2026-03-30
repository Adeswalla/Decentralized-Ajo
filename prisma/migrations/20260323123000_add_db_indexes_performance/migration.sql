-- Add foreign-key and high-traffic filter indexes for performance

CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

CREATE INDEX "Circle_organizerId_idx" ON "Circle"("organizerId");
CREATE INDEX "Circle_status_idx" ON "Circle"("status");

CREATE INDEX "CircleMember_circleId_idx" ON "CircleMember"("circleId");
CREATE INDEX "CircleMember_userId_idx" ON "CircleMember"("userId");
CREATE INDEX "CircleMember_status_idx" ON "CircleMember"("status");

CREATE INDEX "Contribution_circleId_idx" ON "Contribution"("circleId");
CREATE INDEX "Contribution_userId_idx" ON "Contribution"("userId");
CREATE INDEX "Contribution_status_idx" ON "Contribution"("status");
CREATE INDEX "Contribution_circleId_status_idx" ON "Contribution"("circleId", "status");

CREATE INDEX "PaymentSchedule_circleId_idx" ON "PaymentSchedule"("circleId");
CREATE INDEX "PaymentSchedule_status_idx" ON "PaymentSchedule"("status");
CREATE INDEX "PaymentSchedule_circleId_status_idx" ON "PaymentSchedule"("circleId", "status");

CREATE INDEX "GovernanceProposal_circleId_idx" ON "GovernanceProposal"("circleId");
CREATE INDEX "GovernanceProposal_status_idx" ON "GovernanceProposal"("status");
CREATE INDEX "GovernanceProposal_circleId_status_idx" ON "GovernanceProposal"("circleId", "status");

CREATE INDEX "GovernanceVote_proposalId_idx" ON "GovernanceVote"("proposalId");
CREATE INDEX "GovernanceVote_userId_idx" ON "GovernanceVote"("userId");

CREATE INDEX "Withdrawal_circleId_idx" ON "Withdrawal"("circleId");
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
CREATE INDEX "Withdrawal_circleId_status_idx" ON "Withdrawal"("circleId", "status");
