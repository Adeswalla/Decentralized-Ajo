// Query monitoring and performance analysis utilities

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
        console.warn(`🐌 Slow query detected (${duration}ms): ${query}`, {
          userId,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Query failed (${duration}ms): ${query}`, {
        error: (error as Error).message,
        userId,
        timestamp: new Date().toISOString()
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
    console.log('📊 Query Performance Stats:', {
      totalQueries: stats.totalQueries,
      slowQueries: stats.slowQueries,
      slowQueryPercentage: stats.totalQueries > 0 
        ? ((stats.slowQueries / stats.totalQueries) * 100).toFixed(2) + '%'
        : '0%',
      averageDuration: `${stats.averageDuration.toFixed(2)}ms`
    });

    if (stats.slowestQueries.length > 0) {
      console.log('🐌 Slowest Queries:');
      stats.slowestQueries.forEach((query, index) => {
        console.log(`  ${index + 1}. ${query.query} (${query.duration}ms)`);
      });
    }
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
    console.log('🔍 EXPLAIN ANALYZE for query:', query);
    // Return the query plan analysis
    return null;
  } catch (error) {
    console.error('Failed to analyze query:', error);
    return null;
  }
};
