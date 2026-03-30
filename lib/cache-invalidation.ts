import { redisClient } from './redis';

// Cache invalidation utilities for keeping dashboard data fresh
export class CacheInvalidation {
  
  // Invalidate user's dashboard cache when their data changes
  static async invalidateUserDashboard(userId: string): Promise<void> {
    try {
      await redisClient.invalidateUserCache(userId);
      console.log(`Invalidated dashboard cache for user: ${userId}`);
    } catch (error) {
      console.error('Failed to invalidate user dashboard cache:', error);
    }
  }

  // Invalidate circle list cache for all members of a circle
  static async invalidateCircleList(circleId: string): Promise<void> {
    try {
      // This would require tracking which users have access to which circles
      // For now, we'll implement a simple approach using cache patterns
      const pattern = `circles:list:*`;
      const client = redisClient.getClient();
      if (client) {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
          console.log(`Invalidated ${keys.length} circle list cache entries`);
        }
      }
    } catch (error) {
      console.error('Failed to invalidate circle list cache:', error);
    }
  }

  // Invalidate all dashboard caches (useful for major updates)
  static async invalidateAllDashboards(): Promise<void> {
    try {
      const pattern = 'dashboard:stats:*';
      const client = redisClient.getClient();
      if (client) {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
          console.log(`Invalidated ${keys.length} dashboard cache entries`);
        }
      }
    } catch (error) {
      console.error('Failed to invalidate all dashboard caches:', error);
    }
  }

  // Refresh materialized views
  static async refreshMaterializedViews(): Promise<void> {
    try {
      // This would be called via a background job or webhook
      // For now, we'll log that it should be done
      console.log('Materialized views refresh triggered - should be handled by background job');
    } catch (error) {
      console.error('Failed to refresh materialized views:', error);
    }
  }
}

// Export a function to be called after data mutations
export const invalidateCacheAfterMutation = async (
  type: 'contribution' | 'withdrawal' | 'circle' | 'member',
  userId: string,
  circleId?: string
): Promise<void> => {
  
  // Always invalidate the user's dashboard
  await CacheInvalidation.invalidateUserDashboard(userId);
  
  // Invalidate circle list if circle-related data changed
  if (type === 'circle' || type === 'member') {
    await CacheInvalidation.invalidateCircleList(circleId || '');
  }
  
  // For contributions and withdrawals, also invalidate circle list
  if (type === 'contribution' || type === 'withdrawal') {
    await CacheInvalidation.invalidateCircleList(circleId || '');
  }
  
  // Trigger materialized view refresh (async, don't wait)
  CacheInvalidation.refreshMaterializedViews();
};
