// Query monitoring and performance analysis utilities
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'lib', module: 'query-monitor' });

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  userId?: string;
  slow: boolean;
}

class QueryMonitor {
  private metrics: QueryMetrics[] = [];
  private slowQueryThreshold = 1000; // 1 second

  // Monitor a query execution
  async monitorQuery<T>(
    query: string,
    queryFn: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        query,
        duration,
        timestamp: new Date(),
        userId,
        slow: duration > this.slowQueryThreshold
      });
      
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query,
          duration,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query failed', {
        err: error,
        query,
        duration,
        userId,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  // Record query metrics
  private recordMetric(metric: QueryMetrics): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // Get performance statistics
  getStats(): {
    totalQueries: number;
    slowQueries: number;
    averageDuration: number;
    slowestQueries: QueryMetrics[];
  } {
    const totalQueries = this.metrics.length;
    const slowQueries = this.metrics.filter(m => m.slow).length;
    const averageDuration = totalQueries > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;
    
    const slowestQueries = this.metrics
      .filter(m => m.slow)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalQueries,
      slowQueries,
      averageDuration,
      slowestQueries
    };
  }

  // Log current performance stats
  logStats(): void {
    const stats = this.getStats();
    logger.info('Query performance stats', {
      totalQueries: stats.totalQueries,
      slowQueries: stats.slowQueries,
      slowQueryPercentage: stats.totalQueries > 0 
        ? ((stats.slowQueries / stats.totalQueries) * 100).toFixed(2) + '%'
        : '0%',
      averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
      slowestQueries: stats.slowestQueries.map((query) => ({
        query: query.query,
        duration: query.duration,
        userId: query.userId,
      })),
    });
  }

  // Reset metrics
  reset(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const queryMonitor = new QueryMonitor();

// Helper function to add EXPLAIN ANALYZE to queries for debugging
export const explainQuery = async (query: string): Promise<any> => {
  try {
    // This would need to be implemented based on your database setup
    logger.debug('EXPLAIN ANALYZE requested for query', { query });
    // Return the query plan analysis
    return null;
  } catch (error) {
    logger.error('Failed to analyze query', { err: error, query });
    return null;
  }
};
