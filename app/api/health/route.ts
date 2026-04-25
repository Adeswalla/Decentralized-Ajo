import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSorobanClient, STELLAR_CONFIG } from '@/lib/stellar-config';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/health' });

// Rate limiting for deep health checks (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

interface DependencyStatus {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  responseTime: string;
  services: {
    database: string | DependencyStatus;
    sorobanRpc?: string | DependencyStatus;
  };
}

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSorobanRpc(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const client = getSorobanClient();
    
    // Lightweight health check: get network info
    const health = await client.getHealth();
    
    return {
      status: health.status === 'healthy' ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      metadata: {
        rpcUrl: STELLAR_CONFIG.sorobanRpcUrl,
        network: STELLAR_CONFIG.network,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        rpcUrl: STELLAR_CONFIG.sorobanRpcUrl,
        network: STELLAR_CONFIG.network,
      },
    };
  }
}

export async function GET(request: Request) {
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const deepMode = searchParams.get('deep') === '1';

  // Rate limiting for deep mode
  if (deepMode) {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      );
    }
  }

  try {
    if (deepMode) {
      // Deep health check with detailed dependency status
      const [dbStatus, rpcStatus] = await Promise.all([
        checkDatabase(),
        checkSorobanRpc(),
      ]);

      // Determine overall status
      const allStatuses = [dbStatus.status, rpcStatus.status];
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      
      if (allStatuses.every(s => s === 'healthy')) {
        overallStatus = 'healthy';
      } else if (allStatuses.some(s => s === 'down')) {
        overallStatus = 'unhealthy';
      } else {
        overallStatus = 'degraded';
      }

      const response: HealthResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${Date.now() - start}ms`,
        services: {
          database: dbStatus,
          sorobanRpc: rpcStatus,
        },
      };

      return NextResponse.json(
        response,
        { status: overallStatus === 'unhealthy' ? 503 : 200 }
      );
    } else {
      // Shallow health check (fast path for load balancers)
      await prisma.$queryRaw`SELECT 1`;

      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${Date.now() - start}ms`,
        services: {
          database: 'up',
        },
      });
    }
  } catch (error) {
    logger.error('Health check failed', { err: error });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'down',
        },
      },
      { status: 503 }
    );
  }
}
