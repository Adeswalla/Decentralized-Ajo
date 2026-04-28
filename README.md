# Stellar Ajo - Decentralized Savings Circle

A full-stack decentralized savings circle application built on the Stellar Network. Enables groups of people to pool money, take turns receiving lump sums, vote on governance decisions, and manage contributions with full transparency through smart contracts.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Component Documentation](#component-documentation)
- [API Documentation](#api-documentation)
- [Smart Contract](#smart-contract)
- [Deployment](#deployment)

## Overview

**Ajo** (or **Esusu** in West African cultures) is a traditional savings circle where members pool money and take turns receiving the total amount. Stellar Ajo brings this ancient concept to Web3 using:

- **Smart Contracts (Soroban)**: Secure fund management and automation
- **Stellar Network**: Fast, low-cost transactions
- **Decentralized Governance**: Community voting on circle rules
- **Full Transparency**: All transactions on-chain

## Features

### Core Features
- ✅ **Circle Management**: Create and manage savings circles
- ✅ **Member Contributions**: Track contributions from all members
- ✅ **Rotation Payouts**: Automated payout distribution in rounds
- ✅ **Contribution Scheduling**: Set up recurring contribution schedules
- ✅ **Governance Voting**: Members vote on circle decisions
- ✅ **Partial Withdrawals**: Emergency access to funds with penalties
- ✅ **User Accounts**: Email/password authentication with JWT
- ✅ **Wallet Integration**: Connect Stellar wallets (Freighter, Lobstr)

### Wallet Integration

Stellar Ajo includes robust wallet features for seamless Web3 interaction:
- **Network Awareness**: The application continuously monitors the active network of your connected wallet (Freighter, Lobstr). 
- **Safe Signing Context**: If a user attempts to interact with the dApp while their wallet is on the wrong network (e.g., wallet on Mainnet but app is on Testnet), an explicit **Network Mismatch Warning** is shown via a persistent UI badge and modal. The modal explains how to switch the network to safely proceed.
- **Transaction Submission**: Uses Soroban and Stellar SDKs to securely request signatures and poll for transaction success.


### Dashboard Features
- Circle creation and management
- Member management
- Contribution tracking
- Transaction history
- Real-time circle statistics
- Governance proposal voting

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 4
- **State Management**: SWR (for data fetching)
- **Wallet Connection**: Freighter / Stellar Wallets Kit

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Prisma
- **Authentication**: JWT + Password Hashing (bcryptjs)

### Blockchain
- **Network**: Stellar Network (Testnet/Mainnet)
- **Smart Contracts**: Soroban (Rust)
- **Contract Deployment**: Stellar SDK
- **RPC**: Soroban RPC Server

### Development
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Deployment**: Vercel

## Project Structure

```
.
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── auth/              # Authentication endpoints
│   │   └── circles/           # Circle management APIs
│   ├── auth/                  # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── circles/               # Circle pages
│   │   ├── create/
│   │   └── [id]/
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/
│   ├── ui/                    # shadcn/ui components
│   └── wallet-button.tsx      # Wallet connection component
├── contracts/
│   └── ajo-circle/            # Soroban smart contract
│       ├── src/
│       │   └── lib.rs         # Contract implementation
│       └── Cargo.toml
├── lib/
│   ├── auth.ts                # Authentication utilities
│   ├── prisma.ts              # Prisma client
│   ├── stellar-config.ts      # Stellar SDK configuration
│   └── wallet-context.tsx     # Wallet context provider
├── prisma/
│   └── schema.prisma          # Database schema
├── public/                    # Static assets
└── scripts/                   # Utility scripts
```

## Security

### Authentication & Session Management
- **Short-lived Access Tokens**: JWT access tokens have a short TTL (15 minutes) to minimize the window of opportunity for stolen tokens.
- **Refresh Token Rotation**: Every time a refresh token is used, a new one is issued, and the old one is invalidated.
- **Reuse Detection**: If an old refresh token is used, it indicates a potential replay attack. The system detects this and revokes the entire session family for that user, requiring a full re-authentication.
- **HttpOnly Cookies**: Refresh tokens are stored in `HttpOnly`, `Secure`, and `SameSite: Lax` cookies to prevent XSS and mitigate CSRF risks.
- **Password Hashing**: User passwords are securely hashed using `bcryptjs` with a salt factor of 10.
- **Rate Limiting**: Critical authentication endpoints (login, register, refresh) are protected by rate limiting to prevent brute-force attacks.

## Setup Instructions

### Prerequisites
- Node.js 18+ or compatible version
- pnpm (recommended) or npm
- Freighter wallet extension (for wallet integration)
- Vercel account (for deployment)

### 1. Clone and Install

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your configuration:

```env
# Stellar Network (use testnet for development)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Soroban RPC
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=<your-contract-address>

# Database
DATABASE_URL=file:./dev.db

# JWT Secret (change for production!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 3. Set Up Database

```bash
# Generate Prisma client
pnpm prisma generate

# Create database and run migrations
pnpm prisma migrate dev

# Seed database (optional)
pnpm prisma db seed
```

### 4. Deploy Smart Contract

```bash
# Install Soroban CLI
# See: https://developers.stellar.org/docs/smart-contracts/getting-started/setup

# Build the contract
cd contracts/ajo-circle
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet (requires Stellar account with XLM)
# Follow Soroban deployment guide with the compiled WASM

# Update NEXT_PUBLIC_AJO_CONTRACT_ADDRESS in .env.local
```

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Component Documentation

### Live Component Showcase

A live component showcase is available at [`/components-showcase`](http://localhost:3000/components-showcase). This page displays all critical UI components with various states and configurations without requiring additional setup.

**Features:**
- Three critical components documented: `AmountInput`, `ProposalCard`, `ErrorFallback`
- Interactive examples with real-time state changes
- Component prop documentation
- Multiple use cases per component (default, error states, edge cases, etc.)

**Access it:**
```bash
# Start the dev server
pnpm dev

# Visit in browser
http://localhost:3000/components-showcase
```

### Storybook Integration (Optional)

For an interactive component explorer with hot reload and automated documentation, you can set up Storybook:

**Install Storybook (one-time setup):**
```bash
npm install -D --legacy-peer-deps storybook @storybook/react @storybook/nextjs
```

**Run Storybook:**
```bash
npm run storybook
```

Storybook will open at [`http://localhost:6006`](http://localhost:6006) with all component stories pre-configured.

### Component Stories

Component stories are defined in `components/__stories__/`:

- **AmountInput.stories.tsx** - Cryptocurrency amount input with balance validation
  - Default XLM input
  - USDC variant
  - Low balance scenarios
  - Disabled state
  - Exceeds balance error state
  - Scientific notation handling

- **ProposalCard.stories.tsx** - Governance proposal voting card
  - Active proposals ready for voting
  - Passed/Rejected proposal states
  - User already voted state
  - Wallet disconnected scenarios
  - Quorum not met states
  - Different proposal types (emergency payout, member removal, etc.)

- **ErrorFallback.stories.tsx** - Error boundary fallback component
  - Generic errors
  - Network and API errors
  - Timeout scenarios
  - Validation errors
  - Long error messages

### Accordion

Located at `components/ui/accordion.tsx`. Built on [Radix UI Accordion](https://www.radix-ui.com/docs/primitives/components/accordion) with animated open/close transitions.

**1. Single item open at a time (default)**

```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

<Accordion type="single" collapsible>
  <AccordionItem value="fees">
    <AccordionTrigger>What are the contribution fees?</AccordionTrigger>
    <AccordionContent>
      Stellar Ajo charges no platform fees. You only pay the Stellar network
      transaction fee (~0.00001 XLM per operation).
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="payout">
    <AccordionTrigger>How are payouts determined?</AccordionTrigger>
    <AccordionContent>
      Payout order is set when the circle is created and recorded on-chain.
      Each member receives the full pool once per round.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**2. Multiple items open simultaneously**

```tsx
<Accordion type="multiple" defaultValue={["eligibility"]}>
  <AccordionItem value="eligibility">
    <AccordionTrigger>Who can join a circle?</AccordionTrigger>
    <AccordionContent>
      Any user with a connected Stellar wallet can join an open circle or
      be invited by the organizer.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="withdraw">
    <AccordionTrigger>Can I withdraw early?</AccordionTrigger>
    <AccordionContent>
      Partial withdrawals are allowed with a penalty. The penalty amount is
      defined by the circle organizer at creation time.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="governance">
    <AccordionTrigger>How does governance work?</AccordionTrigger>
    <AccordionContent>
      Members submit proposals and vote on circle rule changes. A proposal
      passes when it reaches the quorum threshold set by the organizer.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**3. Disabled item + custom content**

```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="active">
    <AccordionTrigger>Circle rules</AccordionTrigger>
    <AccordionContent>
      <ul className="list-disc pl-4 space-y-1">
        <li>Contributions are due every 7 days.</li>
        <li>Missing two consecutive payments triggers a governance vote.</li>
        <li>Payout order is randomised at circle creation.</li>
      </ul>
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="locked" disabled>
    <AccordionTrigger>Advanced settings (organizer only)</AccordionTrigger>
    <AccordionContent>
      This section is only accessible to the circle organizer.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Accessibility notes**
- Keyboard: `Enter` / `Space` toggles the focused item; `Tab` moves between triggers.
- Each trigger renders as a `<button>` with `aria-expanded` and `aria-controls` managed automatically by Radix UI.
- Pass `aria-label` to `<Accordion>` when the surrounding context doesn't provide a visible heading.

### Component Locations

| Component | Location | Purpose |
|-----------|----------|---------|
| `AmountInput` | `components/ui/amount-input.tsx` | Cryptocurrency amount input with decimal validation |
| `ProposalCard` | `components/governance/proposal-card.tsx` | Governance proposal display and voting interface |
| `ErrorFallback` | `components/error-fallback.tsx` | Error boundary fallback for graceful error handling |
| `Accordion` | `components/ui/accordion.tsx` | Collapsible content sections with animation |

## API Documentation

### Authentication

The full email/password authentication flow is: **Register → Verify Email → Login → (use token) → Refresh → Logout**.

All protected endpoints require the `Authorization: Bearer <token>` header. The refresh token is stored automatically in an `HttpOnly` cookie (`ajo_refresh_token`).

---

#### 1. Register

```http
POST /api/auth/register
Content-Type: application/json
```

**Request body**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response `201`**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account."
}
```

**curl**
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123!","firstName":"John","lastName":"Doe"}'
```

**fetch**
```js
const res = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!',
    firstName: 'John',
    lastName: 'Doe',
  }),
});
const data = await res.json(); // { success: true, message: '...' }
```

> **Password requirements:** minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character.

---

#### 2. Verify Email

After registration, a verification link is sent to the user's email. The link calls:

```http
GET /api/auth/verify-email?token=<verification_token>
```

**Response `200`**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

> Login is blocked until the email is verified. If the token expires (24 hours), use the resend endpoint: `POST /api/auth/verify-email/resend`.

---

#### 3. Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Request body**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response `200`** — sets `ajo_refresh_token` HttpOnly cookie automatically
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "walletAddress": null
  }
}
```

**curl**
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'
```

**fetch**
```js
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // required to store the refresh token cookie
  body: JSON.stringify({ email: 'user@example.com', password: 'SecurePassword123!' }),
});
const { token, user } = await res.json();
// Store `token` in memory (not localStorage) for use in subsequent requests
```

---

#### 4. Authenticated Request

Use the access token from login in the `Authorization` header:

**curl**
```bash
curl https://your-app.vercel.app/api/circles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**fetch**
```js
const res = await fetch('/api/circles', {
  headers: { Authorization: `Bearer ${token}` },
  credentials: 'include',
});
```

---

#### 5. Refresh Token

Access tokens expire after **15 minutes**. Use the refresh endpoint to get a new one — the `ajo_refresh_token` cookie is sent automatically by the browser.

```http
POST /api/auth/refresh
```

**Response `200`** — issues a new access token and rotates the refresh token cookie
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**curl**
```bash
curl -X POST https://your-app.vercel.app/api/auth/refresh \
  -b cookies.txt -c cookies.txt
```

**fetch**
```js
const res = await fetch('/api/auth/refresh', {
  method: 'POST',
  credentials: 'include', // sends the HttpOnly cookie automatically
});
const { token } = await res.json();
```

> If the refresh token has been reused (replay attack), the entire session family is revoked and a `401` is returned — the user must log in again.

---

#### 6. Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response `200`** — revokes all refresh tokens for the user and clears the cookie
```json
{ "success": true }
```

**curl**
```bash
curl -X POST https://your-app.vercel.app/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -b cookies.txt -c cookies.txt
```

**fetch**
```js
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  credentials: 'include',
});
```

---

#### 7. Wallet Authentication (Stellar)

For wallet-based login (Freighter / Lobstr), use the nonce challenge flow:

**Step 1 — Request a nonce**
```http
GET /api/auth/wallet/nonce?address=G...
```
```json
{ "nonce": "a3f9...random...7c2b" }
```

**Step 2 — Sign the nonce with your Stellar keypair and verify**
```http
POST /api/auth/wallet/verify
Content-Type: application/json
```
```json
{
  "address": "GABC...STELLAR_PUBLIC_KEY",
  "nonce": "a3f9...random...7c2b",
  "signature": "<base64-encoded Stellar signature of the nonce>"
}
```

**Response `200`** — sets `ajo_refresh_token` cookie
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "address": "GABC...STELLAR_PUBLIC_KEY"
}
```

---

#### Error Responses

| Status | Code | Meaning |
|--------|------|---------|
| `400` | — | Validation error (missing/invalid fields) |
| `401` | `invalid_credentials` | Wrong email or password |
| `401` | — | Invalid or expired token / nonce |
| `403` | `email_not_verified` | Email not yet verified |
| `409` | — | Email already registered |
| `429` | — | Rate limit exceeded |

### Circles

#### Create Circle
```http
POST /api/circles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Office Savings Circle",
  "description": "Monthly savings circle for office team",
  "contributionAmount": 100.50,
  "contributionFrequencyDays": 7,
  "maxRounds": 12
}
```

#### Get All Circles
```http
GET /api/circles
Authorization: Bearer <token>
```

#### Get Circle Details
```http
GET /api/circles/:id
Authorization: Bearer <token>
```

#### Make Contribution
```http
POST /api/circles/:id/contribute
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100.50
}
```

#### Get Transaction History
```http
GET /api/transactions?page=1&sortBy=createdAt&order=desc
Authorization: Bearer <token>
```

See [Detailed Documentation](./docs/TRANSACTION_HISTORY.md) for strategy and blockchain verification details.

## Smart Contract

### Capability Matrix ✅
Complete [Organizer vs Member authorization matrix](contracts/ajo-circle/README.md#organizer-vs-member-capability-matrix) with 100% test coverage for Unauthorized failures.

### Soroban Contract Features

The Soroban smart contract (`contracts/ajo-circle/src/lib.rs`) implements:

#### Functions
- `initialize_circle()` - Create a new circle
- `add_member()` - Add member to circle
- `contribute()` - Record member contribution
- `claim_payout()` - Claim payout when it's member's turn
- `partial_withdraw()` - Withdraw portion with penalty
- `get_circle_state()` - Query current circle status
- `get_member_balance()` - Query member details
- `get_members()` - List all members

#### Contract State
- Circle metadata (organizer, amounts, frequency, rounds)
- Member records (contributions, withdrawals, payout status)
- Contribution tracking

#### Operations and Policy Docs
- Optimization review: `docs/CONTRACT_OPTIMIZATION_REVIEW.md`
- WASM upgrade + migration policy: `docs/WASM_UPGRADE_POLICY.md`
- Contributor guide for Postgres CI parity: `docs/CONTRIBUTING.md`

### Building the Contract

```bash
cd contracts/ajo-circle

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# The compiled WASM will be in:
# target/wasm32-unknown-unknown/release/ajo_circle.wasm
```

## Deployment

### Deploy to Vercel

1. Push code to GitHub:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. Deploy to Vercel:
   - Connect your GitHub repository at [vercel.com](https://vercel.com)
   - Set environment variables in Vercel dashboard
   - Deploy!

### Stellar Network Deployment

#### Testnet (Recommended for Testing)
- Network: `Test SDF Network ; September 2015`
- Horizon: `https://horizon-testnet.stellar.org`
- Soroban RPC: `https://soroban-testnet.stellar.org`

#### Mainnet (Production)
- Network: `Public Global Stellar Network ; September 2015`
- Horizon: `https://horizon.stellar.org`
- Soroban RPC: `https://soroban.stellar.org`

### Security Checklist

Before mainnet deployment:
- [ ] Change JWT_SECRET to a secure random string
- [ ] Enable HTTPS on production
- [ ] Set up rate limiting on API routes
- [ ] Implement input validation on all endpoints
- [ ] Audit smart contract code
- [ ] Set up database backups
- [ ] Enable wallet signature verification
- [ ] Implement proper error handling

## Database Schema

The application uses Prisma ORM with the following main tables:

- **User**: User accounts and profiles
- **Circle**: Savings circles
- **CircleMember**: Circle membership and rotation tracking
- **Contribution**: Contribution transactions
- **PaymentSchedule**: Payout schedule tracking
- **GovernanceProposal**: Voting proposals
- **GovernanceVote**: Vote records
- **Withdrawal**: Partial withdrawal requests
- **Session**: Authentication sessions

See `prisma/schema.prisma` for complete schema details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Acknowledgments

- [Stellar Development Foundation](https://stellar.org/) - For the incredible Stellar Network and Soroban
- [Vercel](https://vercel.com/) - For deployment infrastructure
- [shadcn/ui](https://ui.shadcn.com/) - For beautiful UI components
- Traditional Ajo/Esusu communities - For inspiring this project

---

**Built with ❤️ for communities saving together.**
