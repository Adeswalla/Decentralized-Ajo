-- Create materialized views for pre-calculated dashboard statistics
-- These views will significantly improve dashboard performance by pre-aggregating data

-- Materialized view for user dashboard statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS "user_dashboard_stats" AS
SELECT 
    u.id as "userId",
    COUNT(DISTINCT CASE WHEN c.status = 'ACTIVE' THEN c.id END) as "activeCircles",
    COALESCE(SUM(CASE WHEN cont.status = 'COMPLETED' THEN cont.amount ELSE 0 END), 0) as "totalContributed",
    COUNT(CASE WHEN cont.status = 'COMPLETED' THEN 1 END) as "contributionCount",
    COUNT(DISTINCT cm.id) as "totalMembers",
    COALESCE(SUM(CASE WHEN w.status = 'COMPLETED' THEN w.amount ELSE 0 END), 0) as "totalWithdrawn",
    MAX(GREATEST(
        COALESCE(cont."createdAt", '1970-01-01'::timestamp),
        COALESCE(w."createdAt", '1970-01-01'::timestamp),
        COALESCE(c."updatedAt", '1970-01-01'::timestamp)
    )) as "lastActivityAt"
FROM "User" u
LEFT JOIN "Circle" c ON (c."organizerId" = u.id OR EXISTS (
    SELECT 1 FROM "CircleMember" cm WHERE cm."circleId" = c.id AND cm."userId" = u.id
))
LEFT JOIN "CircleMember" cm ON cm."userId" = u.id AND cm.status = 'ACTIVE'
LEFT JOIN "Contribution" cont ON cont."userId" = u.id
LEFT JOIN "Withdrawal" w ON w."userId" = u.id
GROUP BY u.id;

-- Create unique index on materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_dashboard_stats_user_id" ON "user_dashboard_stats"("userId");

-- Materialized view for circle statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS "circle_stats" AS
SELECT 
    c.id as "circleId",
    c.name,
    c.status,
    c."organizerId",
    COUNT(DISTINCT cm.id) as "memberCount",
    COALESCE(SUM(CASE WHEN cont.status = 'COMPLETED' THEN cont.amount ELSE 0 END), 0) as "totalContributed",
    COUNT(CASE WHEN cont.status = 'COMPLETED' THEN 1 END) as "completedContributions",
    COUNT(CASE WHEN cont.status = 'PENDING' THEN 1 END) as "pendingContributions",
    COALESCE(SUM(CASE WHEN w.status = 'COMPLETED' THEN w.amount ELSE 0 END), 0) as "totalWithdrawn",
    COUNT(CASE WHEN w.status = 'PENDING' THEN 1 END) as "pendingWithdrawals",
    COUNT(CASE WHEN gp.status = 'ACTIVE' THEN 1 END) as "activeProposals",
    c."createdAt",
    c."updatedAt"
FROM "Circle" c
LEFT JOIN "CircleMember" cm ON cm."circleId" = c.id AND cm.status = 'ACTIVE'
LEFT JOIN "Contribution" cont ON cont."circleId" = c.id
LEFT JOIN "Withdrawal" w ON w."circleId" = c.id
LEFT JOIN "GovernanceProposal" gp ON gp."circleId" = c.id
GROUP BY c.id, c.name, c.status, c."organizerId", c."createdAt", c."updatedAt";

-- Create indexes on circle stats materialized view
CREATE UNIQUE INDEX IF NOT EXISTS "idx_circle_stats_circle_id" ON "circle_stats"("circleId");
CREATE INDEX IF NOT EXISTS "idx_circle_stats_status" ON "circle_stats"("status");
CREATE INDEX IF NOT EXISTS "idx_circle_stats_organizer" ON "circle_stats"("organizerId");

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY circle_stats;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically refresh stats when relevant data changes
-- Note: This is a simplified approach. In production, you might want to use
-- background jobs or more sophisticated refresh strategies

-- Function to be called after contributions are updated
CREATE OR REPLACE FUNCTION trigger_refresh_stats_on_contribution()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('refresh_dashboard_stats', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'userId', NEW."userId"
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic refresh (these will be handled by background workers)
-- DROP TRIGGER IF EXISTS trigger_contribution_refresh ON "Contribution";
-- CREATE TRIGGER trigger_contribution_refresh
--     AFTER INSERT OR UPDATE OR DELETE ON "Contribution"
--     FOR EACH ROW EXECUTE FUNCTION trigger_refresh_stats_on_contribution();
