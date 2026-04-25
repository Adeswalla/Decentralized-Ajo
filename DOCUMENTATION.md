# Stellar Ajo - Documentation Index

Complete guide to all documentation for the Stellar Ajo project.

## Quick Links

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [QUICKSTART.md](./QUICKSTART.md) | Get up and running in 5 minutes | 5 min |
| [README.md](./README.md) | Complete project documentation | 15 min |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | Detailed project overview | 10 min |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development workflow and debugging | 20 min |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment guide | 20 min |
| [TRANSACTION_HISTORY.md](./docs/TRANSACTION_HISTORY.md) | Transaction history system guide | 10 min |

## Start Here

### First Time?
Start with **[QUICKSTART.md](./QUICKSTART.md)** - Gets you running in 5 minutes!

```bash
pnpm install
pnpm dev
```

### Want to Understand the Project?
Read **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** for architecture and features overview.

### Ready to Develop?
Check **[DEVELOPMENT.md](./DEVELOPMENT.md)** for development workflow, debugging, and testing.

### Need to Deploy?
Follow **[DEPLOYMENT.md](./DEPLOYMENT.md)** for production deployment steps.

## Documentation Structure

### Overview
- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup
- **[README.md](./README.md)** - Full documentation
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Project overview

### Development
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Dev workflow, testing, debugging
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment
- **[TRANSACTION_HISTORY.md](./docs/TRANSACTION_HISTORY.md)** - Transaction history system guide

### Code Documentation
- Smart contract comments in `contracts/ajo-circle/src/lib.rs`
- API route documentation in code
- Component prop documentation in JSDoc

## What to Read When

### Scenario: "I want to run it locally"
1. [QUICKSTART.md](./QUICKSTART.md) - 5 minutes
2. `pnpm dev` - Run server
3. Open http://localhost:3000

### Scenario: "I want to understand the architecture"
1. [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Architecture section
2. [README.md](./README.md) - Technology stack
3. Review `app/api/` and `contracts/` directories

### Scenario: "I want to deploy to production"
1. [DEPLOYMENT.md](./DEPLOYMENT.md) - Full steps
2. [DEVELOPMENT.md](./DEVELOPMENT.md) - Testing section
3. Deploy smart contract to Stellar
4. Deploy frontend to Vercel

### Scenario: "I want to add a new feature"
1. [DEVELOPMENT.md](./DEVELOPMENT.md) - Development setup
2. Review similar existing features in codebase
3. Update `prisma/schema.prisma` if needed
4. Create API route in `app/api/`
5. Create frontend component

### Scenario: "I encountered an error"
1. [DEVELOPMENT.md](./DEVELOPMENT.md) - Troubleshooting section
2. Check error logs
3. Search GitHub issues
4. Review code comments
5. Open new issue if needed

## File Organization

### Documentation Files
```
stellar-ajo/
├── QUICKSTART.md          # 5-min setup
├── README.md              # Full docs
├── PROJECT_SUMMARY.md     # Project overview
├── DEVELOPMENT.md         # Dev guide
├── DEPLOYMENT.md          # Deploy guide
├── DOCUMENTATION.md       # This file
└── .env.example           # Environment template
```

### Source Code
```
stellar-ajo/
├── app/                   # Frontend & API
├── components/            # React components
├── lib/                   # Utilities
├── prisma/               # Database schema
├── contracts/            # Smart contract
└── public/               # Static files
```

## Key Concepts

### Ajo/Esusu
Traditional savings circle where members pool money and take turns receiving lump sums.

### Smart Contract
Soroban contract deployed on Stellar that manages fund escrow and automation.

### Circle
A savings group defined by:
- Members
- Contribution amount
- Contribution frequency
- Number of rounds
- Rotation order (who gets paid when)

### Member
A user participating in a circle with:
- Rotation position
- Contribution history
- Payout status
- Withdrawal requests

## Technology Stack Reference

### Frontend
- **Next.js** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Components

### Backend
- **Next.js API Routes** - Serverless functions
- **Prisma** - Database ORM
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Blockchain
- **Stellar** - Network
- **Soroban** - Smart contracts
- **Rust** - Contract language
- **JavaScript SDK** - Integration

## Common Tasks

### I need to...

**...start the development server**
```bash
pnpm dev
```
See [QUICKSTART.md](./QUICKSTART.md)

**...reset the database**
```bash
pnpm prisma migrate reset
```
See [DEVELOPMENT.md](./DEVELOPMENT.md)

**...view database content**
```bash
pnpm prisma studio
```
See [DEVELOPMENT.md](./DEVELOPMENT.md)

**...add a new API endpoint**
1. Create file in `app/api/`
2. Implement handler
3. Test with curl or Postman
See [DEVELOPMENT.md](./DEVELOPMENT.md)

**...modify database schema**
1. Edit `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev`
3. Update API routes if needed
See [DEVELOPMENT.md](./DEVELOPMENT.md)

**...deploy to production**
Follow [DEPLOYMENT.md](./DEPLOYMENT.md) step by step

**...connect a wallet**
1. Install Freighter extension
2. Create/import account
3. Click "Connect Wallet"
4. Sign with wallet
See [README.md](./README.md)

**...test an API endpoint**
Use curl examples in [DEVELOPMENT.md](./DEVELOPMENT.md)

**...debug an issue**
Check troubleshooting in [DEVELOPMENT.md](./DEVELOPMENT.md)

## API Reference

All endpoints documented in [README.md#api-documentation](./README.md#api-documentation)

### Authentication
- POST `/api/auth/register`
- POST `/api/auth/login`

### Circles
- GET `/api/circles`
- POST `/api/circles`
- GET `/api/circles/:id`
- PUT `/api/circles/:id`
- POST `/api/circles/:id/join`
- POST `/api/circles/:id/contribute`

### Users
- PATCH `/api/users/update-wallet` - Update wallet address (simple, no signature required)
- GET `/api/auth/wallet/nonce` - Request a one-time challenge nonce
- POST `/api/auth/wallet/verify` - Verify wallet ownership via Ed25519 signature

See [docs/wallet-update-security.md](./docs/wallet-update-security.md) for the full security guide.

## Smart Contract Reference

Functions available in `contracts/ajo-circle/src/lib.rs`:
- `initialize_circle()` - Create circle
- `add_member()` - Add member
- `contribute()` - Make contribution
- `claim_payout()` - Claim payout
- `partial_withdraw()` - Emergency withdrawal
- `get_circle_state()` - Query state
- `get_member_balance()` - Query member
- `get_members()` - List members

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.

## Environment Variables

All variables documented in `.env.example`:

```
NEXT_PUBLIC_STELLAR_NETWORK      # testnet or mainnet
NEXT_PUBLIC_STELLAR_HORIZON_URL  # Stellar API endpoint
NEXT_PUBLIC_SOROBAN_RPC_URL      # Smart contract RPC
DATABASE_URL                     # Database connection
JWT_SECRET                       # Auth token secret
NEXT_PUBLIC_API_URL             # API base URL
```

Full details in [DEPLOYMENT.md](./DEPLOYMENT.md)

## Troubleshooting Index

- Port conflicts → [DEVELOPMENT.md](./DEVELOPMENT.md)
- Database errors → [DEVELOPMENT.md](./DEVELOPMENT.md)
- Module not found → [DEVELOPMENT.md](./DEVELOPMENT.md)
- Wallet issues → [README.md](./README.md)
- Wallet update security → [docs/wallet-update-security.md](./docs/wallet-update-security.md)
- Contract deployment → [DEPLOYMENT.md](./DEPLOYMENT.md)

## Getting Help

1. **Read relevant documentation** above
2. **Check code comments** in source files
3. **Review GitHub issues** for similar problems
4. **Check troubleshooting sections** in docs
5. **Open new issue** with details and error messages

## Version Information

- **Project Version**: 1.0.0
- **Node.js**: 18+
- **Next.js**: 16.x
- **Prisma**: 5.x
- **TypeScript**: 5.x
- **Stellar SDK**: 11.x

## Updates & Changes

Check GitHub releases for:
- Version updates
- Breaking changes
- New features
- Bug fixes

## Contributing

Want to contribute? See GitHub for:
- How to report issues
- How to submit pull requests
- Development guidelines
- Code of conduct

## License

MIT License - Open source and free to use

## Support Resources

| Resource | Link |
|----------|------|
| Stellar Docs | https://developers.stellar.org/ |
| Next.js Docs | https://nextjs.org/docs |
| Prisma Docs | https://www.prisma.io/docs |
| Soroban Docs | https://developers.stellar.org/docs/smart-contracts/ |
| shadcn/ui | https://ui.shadcn.com/ |
| Tailwind CSS | https://tailwindcss.com/docs |

## Quick Reference

### Setup (5 min)
```bash
git clone <repo>
cd stellar-ajo
pnpm install
cp .env.example .env.local
pnpm prisma migrate dev
pnpm dev
```

### Deploy Contract
See [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploy to Stellar section

### Deploy App
See [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploy to Vercel section

### Common Commands
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm lint             # Run linter
pnpm format           # Format code
pnpm prisma studio   # View database
pnpm prisma migrate  # Run migrations
```

---

**Navigation Guide Complete!**

Start with [QUICKSTART.md](./QUICKSTART.md) and refer back here as needed.

**Questions?** Check the relevant documentation file above, and if not found, open an issue on GitHub.

Last updated: March 2026
