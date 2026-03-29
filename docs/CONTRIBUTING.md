# Contributing to Stellar Ajo

Welcome! This guide gets you from zero to a running local environment and through your first pull request.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and Install](#2-clone-and-install)
3. [Environment Variables](#3-environment-variables)
4. [Database Setup](#4-database-setup)
5. [Run the Development Server](#5-run-the-development-server)
6. [Project Structure](#6-project-structure)
7. [Development Workflow](#7-development-workflow)
8. [Available Scripts](#8-available-scripts)
9. [Testing API Endpoints Locally](#9-testing-api-endpoints-locally)
10. [Common Issues and Fixes](#10-common-issues-and-fixes)
11. [Git Workflow](#11-git-workflow)

---

## 1. Prerequisites

Before cloning the repo, make sure you have the following installed:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| pnpm | 8+ | `npm install -g pnpm` |
| Git | any | https://git-scm.com |
| Rust + Cargo | stable | https://rustup.rs |
| Freighter wallet | latest | https://www.freighter.app (browser extension) |

**Optional but recommended:**

- **Stellar CLI** — for deploying and invoking the smart contract locally
- **Prisma Studio** — included via `pnpm prisma studio`, no separate install needed

---

## 2. Clone and Install

```bash
git clone https://github.com/Adeswalla/Decentralized-Ajo.git
cd Decentralized-Ajo
pnpm install
```

---

## 3. Environment Variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

Required variables for local development:

```env
# Stellar Testnet (use these exact values for local dev)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Leave empty until you deploy the contract
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=

# SQLite for local dev
DATABASE_URL=file:./dev.db

# Change this to any random string for local dev
JWT_SECRET=dev-secret-key-change-in-production

# Local API base URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 4. Database Setup

```bash
# Generate the Prisma client from schema.prisma
pnpm prisma generate

# Create the SQLite database and run all migrations
pnpm prisma migrate dev

# Optional: seed the database with test data
pnpm prisma db seed
```

After seeding, a test account is available:

- **Email:** `test@example.com`
- **Password:** `TestPassword123!`

To browse the database visually:

```bash
pnpm prisma studio
# Opens at http://localhost:5555
```

---

## 5. Run the Development Server

```bash
pnpm dev
# App runs at http://localhost:3000
```

---

## 6. Project Structure

```
Decentralized-Ajo/
├── app/
│   ├── api/                    # Next.js API route handlers
│   │   ├── auth/               # register, login, logout, refresh, wallet
│   │   ├── circles/            # CRUD, join, contribute, governance, vote
│   │   ├── users/              # profile, update-wallet
│   │   ├── transactions/       # transaction history
│   │   └── health/             # health check
│   ├── auth/                   # Login and register pages
│   ├── circles/                # Circle list, create, detail, governance pages
│   ├── profile/                # User profile page
│   ├── transactions/           # Transaction history page
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Home / dashboard page
│
├── components/
│   ├── ui/                     # shadcn/ui component library (58 components)
│   ├── dashboard/              # Circle list component
│   ├── governance/             # Proposal card and create dialog
│   ├── layout/                 # Shared layout components
│   ├── profile-form.tsx        # Profile edit form
│   └── wallet-button.tsx       # Wallet connect/disconnect button
│
├── lib/
│   ├── auth.ts                 # JWT, bcrypt, refresh token utilities
│   ├── auth-client.ts          # Client-side authenticated fetch helper
│   ├── api-helpers.ts          # Request validation and rate limit helpers
│   ├── prisma.ts               # Prisma client singleton
│   ├── stellar-config.ts       # Stellar SDK setup and helpers
│   ├── wallet-context.tsx      # React context for Freighter wallet
│   ├── rate-limit.ts           # Rate limiting configuration
│   ├── email.ts                # Email notification helpers
│   ├── logger.ts               # Logging utility
│   └── validations/            # Zod schemas for all request bodies
│       ├── auth.ts
│       ├── circle.ts
│       ├── governance.ts
│       └── user.ts
│
├── hooks/
│   ├── use-mobile.ts           # Responsive breakpoint hook
│   └── use-toast.ts            # Toast notification hook
│
├── prisma/
│   ├── schema.prisma           # Full database schema
│   ├── seed.ts                 # Database seed script
│   └── migrations/             # Migration history
│
├── contracts/
│   └── ajo-circle/
│       ├── src/lib.rs          # Soroban smart contract (Rust)
│       └── Cargo.toml          # Rust dependencies
│
├── public/                     # Static assets
├── scripts/                    # Utility scripts
├── middleware.ts               # Next.js middleware (auth guards)
├── next.config.mjs             # Next.js configuration
└── .env.example                # Environment variable template
```

---

## 7. Development Workflow

### Adding a New API Endpoint

1. Create a new folder under `app/api/` matching the route path.
2. Add a `route.ts` file with exported `GET`, `POST`, `PATCH`, or `DELETE` functions.
3. Use `extractToken` and `verifyToken` from `lib/auth.ts` for authentication.
4. Use `validateBody` from `lib/api-helpers.ts` with a Zod schema for request validation.
5. Use `applyRateLimit` from `lib/api-helpers.ts` to apply rate limiting.

Example skeleton:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';

const MySchema = z.object({ name: z.string().min(1) });

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'my-route', payload.userId);
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, MySchema);
  if (error) return error;

  // ... handler logic
}
```

### Modifying the Database Schema

1. Edit `prisma/schema.prisma`.
2. Run `pnpm prisma migrate dev --name describe-your-change`.
3. Run `pnpm prisma generate` to update the client.
4. Update any affected API routes.

### Working on the Smart Contract

```bash
cd contracts/ajo-circle

# Build the WASM
cargo build --target wasm32-unknown-unknown --release

# Run unit tests
cargo test
```

---

## 8. Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server on port 3000 |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm prisma studio` | Open database browser |
| `pnpm prisma migrate dev` | Create and apply a new migration |
| `pnpm prisma migrate reset` | Reset database (dev only) |
| `pnpm prisma db seed` | Seed database with test data |

---

## 9. Testing API Endpoints Locally

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"DevPass123!","firstName":"Dev","lastName":"User"}'

# Login and capture the token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"DevPass123!"}' | jq -r '.token')

# Create a circle
curl -X POST http://localhost:3000/api/circles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Dev Circle","contributionAmount":50,"contributionFrequencyDays":7,"maxRounds":6}'

# Health check (no auth needed)
curl http://localhost:3000/api/health
```

---

## 10. Common Issues and Fixes

| Problem | Fix |
|---------|-----|
| Port 3000 already in use | `PORT=3001 pnpm dev` |
| Module not found errors | `pnpm install && pnpm prisma generate` |
| Database migration errors | `pnpm prisma migrate reset` (dev only) |
| Wallet not connecting | Install Freighter, switch to Testnet in extension settings |
| JWT_SECRET warning | Set any non-empty string in `.env.local` |
| Prisma client out of date | `pnpm prisma generate` after any schema change |

---

## 11. Git Workflow

```bash
# Create a feature branch
git checkout -b feat/your-feature-name

# Make changes, then commit
git add .
git commit -m "feat: describe what you added"

# Push and open a pull request
git push origin feat/your-feature-name
```

Commit message prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
