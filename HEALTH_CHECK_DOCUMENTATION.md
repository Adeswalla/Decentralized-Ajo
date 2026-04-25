# Health Check Endpoint Documentation

## Overview

The `/api/health` endpoint provides health status monitoring for the application with two modes:
- **Shallow mode** (default): Fast health check for load balancers
- **Deep mode**: Comprehensive dependency checks with detailed metrics

## Endpoints

### Shallow Health Check (Default)

```
GET /api/health
```

**Purpose**: Fast health check suitable for load balancers and uptime monitors.

**Response Time**: < 50ms typically

**Response Example**:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-23T10:30:00.000Z",
  "uptime": 3600.5,
  "responseTime": "12ms",
  "services": {
    "database": "up"
  }
}
```

**Status Codes**:
- `200`: Service is healthy
- `503`: Service is unhealthy

---

### Deep Health Check

```
GET /api/health?deep=1
```

**Purpose**: Comprehensive health check with detailed dependency status and latency metrics.

**Rate Limiting**: 10 requests per minute per IP address

**Response Time**: 100-500ms typically

**Response Example**:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-23T10:30:00.000Z",
  "uptime": 3600.5,
  "responseTime": "245ms",
  "services": {
    "database": {
      "status": "healthy",
      "latencyMs": 15
    },
    "sorobanRpc": {
      "status": "healthy",
      "latencyMs": 230,
      "metadata": {
        "rpcUrl": "https://soroban-testnet.stellar.org",
        "network": "testnet"
      }
    }
  }
}
```

**Dependency Status Values**:
- `healthy`: Service is fully operational
- `degraded`: Service is operational but experiencing issues
- `down`: Service is unavailable

**Overall Status Logic**:
- `healthy`: All dependencies are healthy
- `degraded`: Some dependencies are degraded but none are down
- `unhealthy`: One or more dependencies are down

**Status Codes**:
- `200`: Service is healthy or degraded
- `429`: Rate limit exceeded
- `503`: Service is unhealthy

---

## Deployment Platform Configuration

### Vercel

Add health check configuration to `vercel.json`:

```json
{
  "healthCheck": {
    "path": "/api/health",
    "maxResponseTime": 5000
  }
}
```

For monitoring dashboards, use the deep mode endpoint with appropriate rate limiting:

```bash
# Shallow check (for load balancer)
curl https://your-app.vercel.app/api/health

# Deep check (for monitoring)
curl https://your-app.vercel.app/api/health?deep=1
```

### Other Platforms

Most platforms support health check configuration. Use:
- **Path**: `/api/health`
- **Method**: `GET`
- **Expected Status**: `200`
- **Timeout**: 5 seconds

---

## Security Considerations

1. **No Secret Leakage**: The endpoint does not expose sensitive configuration details
2. **Rate Limiting**: Deep mode is rate-limited to prevent abuse (10 req/min per IP)
3. **Minimal Metadata**: Only non-sensitive metadata is included in responses

---

## Monitoring Integration

### Prometheus/Grafana

Example metrics to track:
- Response time per mode
- Dependency latency
- Error rates by dependency
- Overall health status

### Datadog/New Relic

Configure synthetic monitoring:
```javascript
// Shallow check every 1 minute
GET /api/health

// Deep check every 5 minutes
GET /api/health?deep=1
```

### Uptime Monitoring (UptimeRobot, Pingdom, etc.)

Use the shallow endpoint for frequent checks:
- **URL**: `https://your-app.com/api/health`
- **Interval**: 1-5 minutes
- **Expected Status**: `200`
- **Expected Content**: `"status":"healthy"`

---

## Testing

### Manual Testing

```bash
# Test shallow mode
curl http://localhost:3000/api/health

# Test deep mode
curl http://localhost:3000/api/health?deep=1

# Test rate limiting (run 11+ times quickly)
for i in {1..15}; do curl http://localhost:3000/api/health?deep=1; done
```

### Automated Testing

```typescript
describe('Health Check', () => {
  it('should return healthy status in shallow mode', async () => {
    const response = await fetch('/api/health');
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.services.database).toBe('up');
  });

  it('should return detailed status in deep mode', async () => {
    const response = await fetch('/api/health?deep=1');
    const data = await response.json();
    expect(data.services.database).toHaveProperty('latencyMs');
    expect(data.services.sorobanRpc).toHaveProperty('status');
  });
});
```

---

## Troubleshooting

### Database Shows as Down

1. Check database connection string in `.env`
2. Verify database is running and accessible
3. Check network connectivity
4. Review Prisma logs

### Soroban RPC Shows as Down

1. Verify `NEXT_PUBLIC_SOROBAN_RPC_URL` is correct
2. Check if the RPC endpoint is accessible
3. Verify network configuration (testnet vs mainnet)
4. Check for rate limiting on the RPC provider

### Rate Limit Errors

The in-memory rate limiter resets every minute. For production, consider:
- Using Redis for distributed rate limiting
- Adjusting rate limits based on usage patterns
- Implementing IP whitelisting for monitoring services

---

## Future Enhancements

Potential improvements:
- Admin-only deep mode with authentication
- Configurable rate limits via environment variables
- Additional dependency checks (cache, message queue, etc.)
- Metrics export endpoint for Prometheus
- Historical health data storage
