# Express Backend Server

This is a standalone Express server for handling off-chain data securely.

## Features

- **Express.js** - Fast, unopinionated web framework
- **Helmet** - Security middleware for HTTP headers
- **CORS** - Cross-Origin Resource Sharing configuration
- **TypeScript** - Type-safe development
- **Health Check** - `/health` endpoint for monitoring

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment variables in `.env`:
```env
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

3. Run the server:

Development mode (with hot reload):
```bash
pnpm dev:server
```

Production build:
```bash
pnpm build:server
pnpm start:server
```

Run both Next.js and Express concurrently:
```bash
pnpm dev:all
```

## Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2026-03-25T10:30:00.000Z",
  "uptime": 123.456
}
```

## Security Features

- **Helmet**: Sets secure HTTP headers
- **CORS**: Configurable origin whitelist
- **Body Size Limits**: 10MB limit on JSON/URL-encoded payloads
- **Error Handling**: Centralized error middleware
- **404 Handler**: Graceful handling of unknown routes

## Adding Routes

Create route files in `server/routes/` and import them in `server/index.ts`:

```typescript
import myRoutes from './routes/myRoutes';
app.use('/api/my-resource', myRoutes);
```
