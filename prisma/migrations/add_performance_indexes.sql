-- Add performance indexes for dashboard queries
-- These indexes will significantly improve query performance for dashboard statistics

-- Index for Circle queries by status and organizer
CREATE INDEX IF NOT EXISTS "idx_circle_status_organizer" ON "Circle"("status", "organizerId");

-- Index for Circle member lookups by user and status
CREATE INDEX IF NOT EXISTS "idx_circle_member_user_status" ON "CircleMember"("userId", "status");

-- Index for Contribution queries by user and status (most common dashboard query)
CREATE INDEX IF NOT EXISTS "idx_contribution_user_status" ON "Contribution"("userId", "status");

-- Index for Contribution queries by circle and status
CREATE INDEX IF NOT EXISTS "idx_contribution_circle_status" ON "Contribution"("circleId", "status");

-- Index for Withdrawal queries by user and status
CREATE INDEX IF NOT EXISTS "idx_withdrawal_user_status" ON "Withdrawal"("userId", "status");

-- Index for PaymentSchedule queries by circle and status
CREATE INDEX IF NOT EXISTS "idx_payment_schedule_circle_status" ON "PaymentSchedule"("circleId", "status");

-- Composite index for GovernanceProposal queries by circle and status
CREATE INDEX IF NOT EXISTS "idx_governance_proposal_circle_status" ON "GovernanceProposal"("circleId", "status");

-- Index for UserAjoParticipation queries by user and status
CREATE INDEX IF NOT EXISTS "idx_user_ajo_participation_user_status" ON "UserAjoParticipation"("userId", "status");

-- Index for Notification queries by user and read status
CREATE INDEX IF NOT EXISTS "idx_notification_user_read" ON "Notification"("userId", "read");

-- Partial index for active circles only (most common query)
CREATE INDEX IF NOT EXISTS "idx_circle_active" ON "Circle"("organizerId") WHERE "status" = 'ACTIVE';

-- Partial index for completed contributions (aggregation queries)
CREATE INDEX IF NOT EXISTS "idx_contribution_completed" ON "Contribution"("userId", "amount") WHERE "status" = 'COMPLETED';

-- Partial index for completed withdrawals (aggregation queries)
CREATE INDEX IF NOT EXISTS "idx_withdrawal_completed" ON "Withdrawal"("userId", "amount") WHERE "status" = 'COMPLETED';
