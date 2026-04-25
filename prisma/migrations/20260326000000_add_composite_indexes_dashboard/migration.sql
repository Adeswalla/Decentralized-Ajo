-- Add composite indexes to optimize dashboard statistics queries
-- These cover the (userId, status) filter pattern used in /api/stats

-- Contribution: userId + status (used in SUM/COUNT for completed contributions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contribution_userId_status_idx"
  ON "Contribution"("userId", status);

-- Withdrawal: userId + status (used in SUM for completed withdrawals)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Withdrawal_userId_status_idx"
  ON "Withdrawal"("userId", status);

-- Circle: organizerId + status (used in active circle count)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Circle_organizerId_status_idx"
  ON "Circle"("organizerId", status);

-- CircleMember: userId + status (used in total members count)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CircleMember_userId_status_idx"
  ON "CircleMember"("userId", status);
