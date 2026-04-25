# Component Documentation

This document provides comprehensive documentation of critical UI components used throughout the Stellar Ajo application.

## Quick Links

- **Live Showcase**: [`/components-showcase`](http://localhost:3000/components-showcase) - Interactive component gallery
- **Story Files**: `components/__stories__/*.stories.tsx` - Storybook-compatible stories
- **Component Locations**: See [Components Reference](#components-reference) below

## Components Reference

### 1. AmountInput

**Location**: `components/ui/amount-input.tsx`

**Purpose**: A specialized numeric input component for cryptocurrency amounts with balance validation and precision control.

#### Features

- **Asset Support**: Handles different cryptocurrency units (XLM with 7 decimals, USDC with 2 decimals)
- **Balance Validation**: Prevents users from entering amounts exceeding available balance
- **Decimal Precision**: Enforces correct decimal places per asset type
- **MAX Button**: Quick button to set input to maximum available balance
- **Scientific Notation**: Automatically converts scientific notation to plain decimal format
- **Error State**: Shows visual feedback when amount exceeds balance

#### Props

```typescript
interface AmountInputProps {
  unit?: AssetUnit;                    // 'XLM' | 'USDC', default: 'XLM'
  balance: string | number;             // Available balance
  onValueChange: (value: string) => void; // Callback on input change
  placeholder?: string;                 // Input placeholder
  disabled?: boolean;                   // Disable input, default: false
}
```

#### Usage Example

```tsx
import { AmountInput } from '@/components/ui/amount-input';

export function ContributionForm() {
  const [amount, setAmount] = useState('');
  const userBalance = '1000.5';

  return (
    <AmountInput
      unit="XLM"
      balance={userBalance}
      onValueChange={setAmount}
      placeholder="0.0000000"
    />
  );
}
```

#### States Covered

| State | Screenshot | Use Case |
|-------|-----------|----------|
| **Default** | Good balance, empty input | Normal contribution entry |
| **Low Balance** | User has limited funds | Warning scenario |
| **Disabled** | Input cannot be modified | Read-only display |
| **Exceeds Balance** | Amount > available | Error feedback |
| **Zero Balance** | User has no funds | Blocked from contributing |

---

### 2. ProposalCard

**Location**: `components/governance/proposal-card.tsx`

**Purpose**: Renders individual governance proposals with voting interface, vote tallies, and quorum tracking.

#### Features

- **Vote Tally Display**: Shows Yes/No/Abstain vote counts with percentages
- **Quorum Progress**: Visual progress bar showing quorum status
- **Voting Interface**: Radio buttons for vote selection and submit button
- **Vote State Tracking**: Prevents users from voting twice
- **Countdown Timer**: Shows remaining voting time with auto-update
- **Wallet Detection**: Shows warning if wallet is not connected
- **Status Variants**: Active, Passed, Rejected, Executed, Pending states
- **Proposal Types**: Rule Change, Member Removal, Emergency Payout, Circle Dissolution, Contribution Adjustment

#### Props

```typescript
interface ProposalCardProps {
  proposal: Proposal;           // Proposal data object
  onVote: (proposalId: string, voteChoice: string) => Promise<void>; // Vote handler
  isWalletConnected: boolean;   // Wallet connection status
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposalType: string;
  status: string;
  votingStartDate: string;      // ISO 8601
  votingEndDate: string;        // ISO 8601
  requiredQuorum: number;       // Percentage (0-100)
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  totalVotes: number;
  totalMembers: number;
  userVote: string | null;      // 'YES' | 'NO' | 'ABSTAIN' | null
  quorumPercentage: number;     // Current quorum (0-100)
}
```

#### Usage Example

```tsx
import { ProposalCard } from '@/components/governance/proposal-card';

export function ProposalsList({ proposals, isWalletConnected }) {
  const handleVote = async (proposalId: string, voteChoice: string) => {
    const response = await fetch(
      `/api/circles/${circleId}/governance/${proposalId}/vote`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteChoice }),
      }
    );
    // Handle response
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          onVote={handleVote}
          isWalletConnected={isWalletConnected}
        />
      ))}
    </div>
  );
}
```

#### States Covered

| State | Voting Allowed | Vote Buttons | Notes |
|-------|----------------|--------------|-------|
| **Active** | Yes (if wallet connected) | Show | Normal voting state |
| **Passed** | No | Hidden | Successful proposal |
| **Rejected** | No | Hidden | Failed proposal |
| **Already Voted** | No | Hidden | Shows "You voted: YES/NO/ABSTAIN" |
| **Wallet Disconnected** | No | Hidden | Warning badge shown |
| **Quorum Not Met** | Yes (if active) | Show | Users can still vote |
| **High Abstention** | Yes (if active) | Show | Significant abstain votes |

#### Countdown Display

- **Days**: `X d Yh remaining`
- **Hours**: `X h Ym remaining`
- **Minutes**: `X m remaining`
- **Expired**: `Voting ended`

---

### 3. ErrorFallback

**Location**: `components/error-fallback.tsx`

**Purpose**: React Error Boundary fallback component for displaying user-friendly error messages and recovery options.

#### Features

- **User-Friendly Messages**: Shows clear error text
- **Retry Mechanism**: Provides button to attempt recovery
- **Accessible**: Proper semantic HTML and ARIA attributes
- **Themed**: Matches application design system
- **Centered Layout**: Fits naturally in any container

#### Props

```typescript
interface ErrorFallbackProps {
  error: Error;                        // Error object with message
  resetErrorBoundary: () => void;      // Callback when user clicks Retry
}
```

#### Usage Example

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error-fallback';

export function CircleList() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div>
        {/* Component that might throw error */}
      </div>
    </ErrorBoundary>
  );
}
```

#### Common Error Scenarios

| Error Type | Example Message | Recovery |
|------------|-----------------|----------|
| **Network** | "Failed to fetch circles. Please check your connection and try again." | User clicks Retry |
| **API** | "Server error: Unable to process your request. Please try again later." | Retry or contact support |
| **Timeout** | "Request timeout. The operation took too long. Please try again." | Automatic retry or manual retry |
| **Validation** | "Invalid amount. Please enter a number between 0.1 and 10000." | User fixes input |
| **Not Found** | "Circle not found. It may have been deleted or you may not have access." | Navigate back |
| **Permission** | "You do not have permission to perform this action." | User must be authorized |

#### Error Styling

```
┌─────────────────────────────────────┐
│ 🔴 Failed to load                   │
│                                     │
│ Network connection error. Please    │
│ try again.                          │
│                                     │
│         [Retry]                     │
└─────────────────────────────────────┘
```

---

## View Components

### Live Showcase

Access the interactive component showcase at:
```
http://localhost:3000/components-showcase
```

**Includes:**
- All three components with multiple state examples
- Real-time interaction
- Component prop documentation
- Usage examples

### Storybook (Optional)

After installing Storybook dependencies:
```bash
npm install -D --legacy-peer-deps storybook @storybook/react @storybook/nextjs
npm run storybook
```

Access at: `http://localhost:6006`

---

## Component Story Files

### AmountInput Stories

**Location**: `components/__stories__/AmountInput.stories.tsx`

**Covered Scenarios:**
1. Default XLM input
2. USDC variant
3. Low balance state
4. Disabled state
5. Exceeds balance error
6. Zero balance
7. Scientific notation
8. Large amounts
9. Interactive demo

### ProposalCard Stories

**Location**: `components/__stories__/ProposalCard.stories.tsx`

**Covered Scenarios:**
1. Active proposal
2. Close to deadline
3. Passed proposal
4. Rejected proposal
5. User already voted
6. Wallet disconnected
7. Quorum not met
8. Unanimous yes votes
9. High abstention rate
10. Emergency payout
11. Member removal
12. Interactive voting demo

### ErrorFallback Stories

**Location**: `components/__stories__/ErrorFallback.stories.tsx`

**Covered Scenarios:**
1. Generic error
2. Network error
3. API error
4. Timeout error
5. Validation error
6. Component render error
7. Permission error
8. Not found error
9. Long error messages
10. Interactive retry demo
11. Data loading error
12. Form submission error
13. Wallet error
14. Smart contract error

---

## Development Workflow

### Adding a New Component to Showcase

1. Create your component in `components/your-component.tsx`
2. Create stories in `components/__stories__/YourComponent.stories.tsx`
3. Follow existing story patterns with multiple state examples
4. Update this documentation with component details
5. Component will automatically appear in:
   - `/components-showcase` (if you update the page)
   - Storybook (when running)

### Best Practices

- **Story Coverage**: Include at least 3-5 stories per component
- **State Variations**: Cover success, error, loading, empty states
- **Edge Cases**: Show boundary conditions (zero values, max limits)
- **Accessibility**: Ensure keyboard navigation works
- **Responsiveness**: Test on mobile and desktop views

---

## Related Documentation

- [Frontend Guide](./FRONTEND_GUIDE.md) - Full frontend application guide
- [API Reference](./API_REFERENCE.md) - Backend API endpoints
- [Component Locations](../components/) - Source code directory

