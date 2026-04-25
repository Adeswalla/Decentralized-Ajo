#!/usr/bin/env tsx

// Background script to refresh materialized views periodically
// This can be run as a cron job or background process

import { prisma } from '../lib/prisma';

async function refreshMaterializedViews() {
  try {
    console.log('Starting materialized views refresh...');
    
    // Refresh user dashboard stats
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats`;
    console.log('✓ Refreshed user_dashboard_stats materialized view');
    
    // Refresh circle stats
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY circle_stats`;
    console.log('✓ Refreshed circle_stats materialized view');
    
    console.log('Materialized views refresh completed successfully');
  } catch (error) {
    console.error('Failed to refresh materialized views:', error);
    throw error;
  }
}

// Run the refresh
refreshMaterializedViews()
  .then(() => {
    console.log('Stats refresh completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Stats refresh failed:', error);
    process.exit(1);
  });
