# Frontend Application Guide

## Overview

This document comprehensively describes the frontend application: every page, its route, what it renders, how it fetches data, and how it handles auth state. Contributors should be able to open this doc and immediately understand the UI layer without reading source code.

## Application Routes

| Route | File | Auth Required | Description |
|-------|------|---------------|-------------|
| / | app/page.tsx | Conditional | Landing page for guests; dashboard for authenticated users |
| /auth/login | app/auth/login/page.tsx | No | Email/password login form |
| /auth/register | app/auth/register/page.tsx | No | New account registration form |
| /circles/create | app/circles/create/page.tsx | Yes | Create a new savings circle |
| /circles/join | app/circles/join/page.tsx | Yes | Join an existing circle |
| /circles/[id] | app/circles/[id]/page.tsx | Yes | Circle detail with tabs |
| /circles/[id]/governance | app/circles/[id]/governance/page.tsx | Yes | Governance proposals and voting |
| /profile | app/profile/page.tsx | Yes | User profile settings |
| /transactions | app/transactions/page.tsx | Yes | Transaction history |

## Page-by-Page Documentation

### / — Home / Dashboard (app/page.tsx)

#### Guest View (Not Authenticated)

Renders the `LandingPage` component with:

- Header with Sign In and Get Started buttons
- Hero section with tagline and CTA
- Features section: Full Control, Community Trust, Smart Contracts
- CTA section and footer

#### Authenticated View

- Reads token and user from localStorage on mount
- Fetches circles from `GET /api/circles` via `authenticatedFetch`
- Displays three stat cards:
  - Active Circles count
  - Total Members across all circles
  - Total Pooled XLM
- Renders a searchable, filterable circle list using:
  - Debounced search input for client-side filtering
  - Status tabs: All, Active, Pending, Done
- "Create Circle" button links to `/circles/create`

#### State Management

- `isAuthenticated` — derived from presence of `localStorage.token`
- `circles` — array of Circle objects
- `searchQuery` / `debouncedSearchQuery` — for client-side search
- `statusFilter` — 'ALL' | 'ACTIVE' | 'PENDING' | 'COMPLETED'

---

### /auth/login — Login (app/auth/login/page.tsx)

Email/password login form. On successful authentication, stores the JWT token in `localStorage.token` and redirects to the dashboard.

---

### /auth/register — Registration (app/auth/register/page.tsx)

New account registration form. Collects user information and creates a new account.

---

### /circles/create — Create Circle (app/circles/create/page.tsx)

Form to create a new savings circle. Requires authentication. On success, redirects to the new circle's detail page.

---

### /circles/join — Join Circle (app/circles/join/page.tsx)

Form to join an existing circle by circle ID or code. Requires authentication.

---

### /circles/[id] — Circle Detail (app/circles/[id]/page.tsx)

#### Data Fetching

Fetches circle data from `GET /api/circles/:id` on mount.

#### Tabs

1. **Overview** — Shows circle info (organizer, frequency, total rounds) and a contribution form
   - If the user is not a member, shows a "Join This Circle" prompt instead
2. **Members** — Lists all members with their rotation order, total contributed, and payout status
   - Organizer sees an "Invite Members" button
3. **Contributions** — Full contribution history with member name, round number, amount, and status
4. **Governance** — Summary of governance types with a link to `/circles/[id]/governance`

#### Stat Cards Displayed

- Members count
- Current Round / Max Rounds
- Per Contribution amount in XLM
- Payout Amount = `contributionAmount * memberCount` XLM

#### Contribution Form

- Number input pre-filled with `circle.contributionAmount`
- On submit: `POST /api/circles/:id/contribute` with `{ amount }`
- Shows toast on success/error
- Refetches circle data after success

#### Auth Handling

- Redirects to `/auth/login` if no token
- Shows toast and redirects to `/` on 403 or 404 errors

---

### /circles/[id]/governance — Governance Page (app/circles/[id]/governance/page.tsx)

#### Data Fetching

Fetches proposals from `GET /api/circles/:id/governance` on mount.

#### Features

- **Filter Buttons**: All, Active, Passed, Rejected — each shows a count badge
- **Proposal Grid**: Proposals rendered in a responsive 3-column grid using `ProposalCard` component
- **Empty State**: Contextual message based on active filter
- **Create Proposal Button**: Opens `CreateProposalDialog`

#### Creating a Proposal

Calls `POST /api/circles/:id/governance` with:

```json
{
  "title": "string",
  "description": "string",
  "proposalType": "string",
  "votingEndDate": "ISO 8601 date",
  "requiredQuorum": "number"
}
```

#### Voting

- Each `ProposalCard` calls `POST /api/circles/:id/governance/:proposalId/vote` with `{ voteChoice }`
- Wallet connection status (`isConnected` from `useWallet`) is passed to `ProposalCard`
- Voting may require a connected wallet

---

### /profile — Profile Settings (app/profile/page.tsx)

#### Features

Uses `ProfileForm` component. Allows updating:

- `firstName` (2–50 chars)
- `lastName` (2–50 chars)
- `bio` (max 160 chars)
- `phoneNumber` (max 20 chars)

#### API Call

Calls `PATCH /api/users/profile` on submit.

---

### /transactions — Transaction History (app/transactions/page.tsx)

#### Features

- Fetches from `GET /api/transactions`
- Displays contribution and withdrawal history for the authenticated user

---

## Shared Components

### WalletButton (components/wallet-button.tsx)

**When disconnected:**
- Renders "Connect Wallet" button
- Calls `connectWallet()` from `useWallet`

**When connected:**
- Renders a dropdown showing the truncated address (GABC...XYZ)
- Options: Copy Address and Disconnect
- Uses sonner toast on copy success

---

### ThemeToggle (components/theme-toggle.tsx)

Toggles between light and dark mode using `next-themes`.

---

### ProposalCard (components/governance/proposal-card.tsx)

Displays a single governance proposal with:

- Vote counts
- Quorum progress
- Voting end date
- YES/NO/ABSTAIN vote buttons

---

### CreateProposalDialog (components/governance/create-proposal-dialog.tsx)

Modal dialog with a form for creating a new governance proposal.

**Fields:**
- Title
- Description
- Proposal type
- Voting end date
- Required quorum

---

### CircleList (components/dashboard/circle-list.tsx)

Renders the list of circles on the dashboard with:

- Loading skeleton
- Empty state

---

## Authentication & API Utilities

### Auth Client (lib/auth-client.ts)

#### authenticatedFetch(url, options?)

Wrapper around `fetch` that:

- Automatically attaches the `Authorization: Bearer <token>` header from `localStorage.token`
- Used by all pages to make authenticated API calls

**Usage:**

```typescript
const response = await authenticatedFetch('/api/circles');
const data = await response.json();
```

---

## Root Layout (app/layout.tsx)

Wraps the entire app with:

- `ThemeProvider` for dark/light mode
- `WalletProvider` for wallet context
- `Toaster` for sonner notifications

---

## Middleware (middleware.ts)

Runs on all routes except `_next/static`, `_next/image`, and `favicon.ico`.

For every request:

1. Generates a UUID `requestId` via `crypto.randomUUID()`
2. Attaches it as the `x-request-id` request and response header
3. Logs a structured JSON entry for incoming request and outgoing response including:
   - Method
   - Path
   - Status
   - Duration in milliseconds

**Note:** Route-level auth protection is handled inside each API route handler, not in middleware.
