# Stellar Ajo - Development Guide

Guide for setting up and running Stellar Ajo in development mode.

## Prerequisites

- Node.js 18+ (check with `node --version`)
- pnpm 8+ (install with `npm install -g pnpm`)
- PostgreSQL 12+ (for development database)
- Stellar CLI (for smart contract testing)
- Freighter wallet extension (for browser testing)
w
# Generate Prisma client
pnpm prisma generate

# Create database
pnpm prisma migrate dev

# Start development server
pnpm dev
```

Visit `http://localhost:3000` in your browser.

### 2. Create Test Account

Use the demo credentials in the login page, or create a new account:

```
Email: test@example.com
Password: TestPassword123!
```

## Development Commands

### Run Development Server
```bash
pnpm dev
```
Server runs on `http://localhost:3000`

### Database Management

```bash
# View/edit database schema
pnpm prisma studio

# Run migrations
pnpm prisma migrate dev

# Reset database (clears all data!)
pnpm prisma migrate reset

# Seed database with test data
pnpm prisma db seed

# Generate client after schema changes
pnpm prisma generate
```

### Smart Contract Development

```bash
# Build the contract
cd contracts/ajo-circle
cargo build --target wasm32-unknown-unknown --release

# Test the contract (requires soroban-cli)
soroban contract build --manifest-path ./Cargo.toml

# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/ajo_circle.wasm \
  --source <your-key> \
  --network testnet
```

### Linting & Formatting

```bash
# Run ESLint
pnpm lint

# Format code with Prettier
pnpm format

# Check formatting
pnpm format:check
```

## Testing

### Manual Testing Flow

1. **Registration & Login**
   - Go to `/auth/register`
   - Create new account
   - Login with credentials

2. **Circle Creation**
   - Click "Create Circle"
   - Fill in circle details
   - Submit and verify

3. **Member Management**
   - View circle details
   - Make contributions
   - Check transaction history

4. **Wallet Integration**
   - Install Freighter extension
   - Click "Connect Wallet"
   - Sign transaction
   - Verify wallet address saved

## Database Seeding

Create `prisma/seed.ts` for test data:

```typescript
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

async function main() {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: await hashPassword('TestPassword123!'),
      firstName: 'Test',
      lastName: 'User',
      verified: true,
    },
  });

  // Create test circle
  const circle = await prisma.circle.create({
    data: {
      name: 'Test Circle',
      description: 'A test savings circle',
      organizerId: user.id,
      contributionAmount: 100,
      contributionFrequencyDays: 7,
      maxRounds: 12,
    },
  });

  console.log('Seeding complete!');
}

main();
```

Then run:
```bash
pnpm prisma db seed
```

## Environment Variables

Key variables for development:

```env
# Database (SQLite for dev, PostgreSQL for production)
DATABASE_URL=file:./dev.db

# Stellar Network (use testnet)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Smart Contract (leave empty if not deployed yet)
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=

# JWT Secret (change this!)
JWT_SECRET=dev-secret-key-change-in-production

# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## API Testing

### Using cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'

# Create circle (replace TOKEN)
curl -X POST http://localhost:3000/api/circles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Test Circle",
    "description": "A test circle",
    "contributionAmount": 100,
    "contributionFrequencyDays": 7,
    "maxRounds": 12
  }'
```

### Using Postman

1. Import the API collection (create from API routes)
2. Set up environment variables (BASE_URL, TOKEN)
3. Test each endpoint

## Debugging

### Console Logging

```typescript
// Add debug logs with [v0] prefix
console.log('[v0] User data:', userData);
console.log('[v0] Circle created:', circle);
```

### Browser DevTools

- Check Network tab for API calls
- Use React DevTools for component state
- Check localStorage for auth tokens

### Database Debugging

```bash
# View all data
pnpm prisma studio

# Export database
sqlite3 dev.db ".dump" > backup.sql
```

### Stellar Network Debugging

```bash
# Check account details
curl https://horizon-testnet.stellar.org/accounts/<ACCOUNT_ID>

# Check transaction
curl https://horizon-testnet.stellar.org/transactions/<TX_HASH>

# Check contract invocation
soroban contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  --source <KEY> \
  -- <METHOD_NAME> <ARGS>
```

## Common Issues

### Database Locked

```bash
# Reset migrations
rm -f prisma/migrations/*/migration.lock
pnpm prisma migrate reset
```

### Dependencies Not Installing

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Wallet Connection Issues

1. Make sure Freighter is installed
2. Switch to testnet in Freighter
3. Create/import an account
4. Reload the page

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

## Performance Tips

### Database Queries

```typescript
// Use select to limit fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    // Don't select sensitive fields like password
  },
});

// Use where for filtering
const activeCircles = await prisma.circle.findMany({
  where: {
    status: 'ACTIVE',
  },
});
```

### Frontend Optimization

```typescript
// Use SWR for data fetching
import useSWR from 'swr';

function CirclesList() {
  const { data, error } = useSWR('/api/circles', fetcher);
  // Data is cached and revalidated automatically
}
```

## File Organization

```
📂 app/
  📂 api/              - API routes
  📂 auth/             - Auth pages
  📂 circles/          - Circle pages
  📄 layout.tsx        - Root layout
  📄 page.tsx          - Home page

📂 components/
  📂 ui/               - shadcn/ui components
  📄 wallet-button.tsx - Wallet component

📂 lib/
  📄 auth.ts           - Auth utilities
  📄 prisma.ts         - Prisma client
  📄 stellar-config.ts - Stellar config

📂 prisma/
  📄 schema.prisma     - Database schema

📂 contracts/
  📂 ajo-circle/       - Smart contract
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes
git add .
git commit -m "feat: add feature"

# Push and create PR
git push origin feature/feature-name
```

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Stellar Docs](https://developers.stellar.org/)
- [Soroban Docs](https://developers.stellar.org/docs/smart-contracts/)
- [shadcn/ui](https://ui.shadcn.com/)

## Support

For help with development:
- Check existing GitHub issues
- Review documentation
- Ask in development channel
- Open new issue with reproduction steps

---

Happy coding! 🚀
