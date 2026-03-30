# Environment Variables: Purpose, Values, and Security Rules

## Variable Categories

### Public Variables (browser-accessible)
Prefixed with `NEXT_PUBLIC_`. These are embedded into the JavaScript bundle at build time and are visible to anyone who inspects the page source. **Never put secrets here.**

### Server-Only Variables
No prefix. Only available in API routes and server-side code. Never exposed to the browser.

## Complete Variable Reference

### Stellar Network

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | Yes | `testnet` or `mainnet` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Yes | Yes | Stellar Horizon REST API endpoint |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Yes | Yes | Network passphrase used when signing transactions |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Yes | Yes | Soroban RPC endpoint for smart contract calls |
| `NEXT_PUBLIC_AJO_CONTRACT_ADDRESS` | Yes* | Yes | Deployed Soroban contract ID. Can be empty until contract is deployed |
| `NEXT_PUBLIC_WALLET_NETWORK_DETAILS_PUBLIC_KEY` | No | Yes | Wallet network details key, defaults to public |

### Database

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `DATABASE_URL` | Yes | No | Prisma database connection string |

### Authentication

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `JWT_SECRET` | Yes | No | Secret key used to sign and verify JWT access tokens. Must be a long random string in production |

### API

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Yes | Base URL for API calls from the browser |

### Email

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `RESEND_API_KEY` | Yes* | No | Resend API key for sending transactional emails. Required for email notifications to work |

## Values by Environment

### Local Development

```bash
# Stellar — Testnet
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=

# Database — SQLite
DATABASE_URL="file:./dev.db"

# Auth — any non-empty string is fine locally
JWT_SECRET=dev-secret-key-change-in-production

# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Email — optional for local dev
RESEND_API_KEY=
```

### Staging / Testnet

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=<testnet-contract-id>

DATABASE_URL=postgresql://user:password@host:5432/ajo_staging

JWT_SECRET=<generate-with-openssl-rand-hex-32>

NEXT_PUBLIC_API_URL=https://staging.yourdomain.com/api

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

### Production / Mainnet

```bash
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=<mainnet-contract-id>

DATABASE_URL=postgresql://user:password@host:5432/ajo_production

JWT_SECRET=<generate-with-openssl-rand-hex-32>

NEXT_PUBLIC_API_URL=https://yourdomain.com/api

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

## Generating a Secure JWT Secret

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

The output is a 64-character hex string. Use this as `JWT_SECRET` in production.

## Database URL Formats

### SQLite (development only):
```
DATABASE_URL="file:./dev.db"
```

### PostgreSQL (staging and production):
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

### With SSL (required by most managed PostgreSQL providers):
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

## Setting Variables in Vercel

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add each variable with the appropriate value
3. Select which environments it applies to: **Production**, **Preview**, **Development**
4. **Redeploy** for changes to take effect

**Note**: Variables prefixed with `NEXT_PUBLIC_` must be set before the build runs — they are baked into the bundle.

## Security Rules

- Never commit `.env.local` or any file containing real secrets to Git
- `.env.local` is already in `.gitignore`
- Only `.env.example` (with placeholder values) should be committed
- Rotate `JWT_SECRET` if it is ever exposed — all existing sessions will be invalidated
- **Never** put `JWT_SECRET`, `DATABASE_URL`, or `RESEND_API_KEY` in any `NEXT_PUBLIC_` variable

