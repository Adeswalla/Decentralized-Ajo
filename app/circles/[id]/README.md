# Circle Detail View

Comprehensive dashboard for circle members and organizers to track progress and manage governance.

## Structure

```
app/circles/[id]/
├── page.tsx                          # Main entry point
└── components/
    ├── CircleOverview.tsx            # Overview tab with stats and contribution form
    ├── MemberTable.tsx               # Members tab with rotation order
    ├── ContributionHistory.tsx       # History tab with timeline
    └── OrganizerActions.tsx          # Admin tab (organizer only)
```

## Features

### Overview Tab
- Circle progress bar showing current round vs max rounds
- Key metrics cards (Current Pot, Per Round, Payout Amount)
- Circle information (organizer, status, members, contract address)
- Contribution form for members

### Members Tab
- Sortable table by rotation order
- "Next in Line" indicator for upcoming payout
- Member status badges (ACTIVE, INACTIVE, etc.)
- Payout status indicators
- Organizer crown icon
- Total contributed and withdrawn amounts

### History Tab
- Timeline of all contributions
- Status icons (completed, pending, failed)
- Transaction hash display
- Formatted dates and amounts

### Admin Tab (Organizer Only)
- Circle status management (PENDING, ACTIVE, COMPLETED, CANCELLED)
- Circle statistics dashboard
- Governance proposal creation link
- Danger zone with circle cancellation

## Data Flow

1. Page fetches circle data from `/api/circles/[id]`
2. Data includes:
   - Circle details
   - Members with rotation order
   - Contributions history
   - Payment schedules
   - Organizer information

3. Components receive data via props
4. Actions trigger API calls and refresh data

## Utilities

- `formatXLM(amount)` - Formats XLM amounts with proper decimals
- `formatDate(date)` - Formats dates in readable format

## Access Control

- Non-members see "Join Circle" CTA
- Members see Overview, Members, and History tabs
- Organizers additionally see Admin tab
- API enforces membership checks

## Responsive Design

- Mobile-friendly layout
- Collapsible stats on small screens
- Responsive tables and cards
- Touch-friendly buttons

## Status Badges

- PENDING: Secondary variant (yellow)
- ACTIVE: Default variant (blue)
- COMPLETED: Outline variant (gray)
- CANCELLED: Destructive variant (red)
