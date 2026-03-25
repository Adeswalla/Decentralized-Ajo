# Design Document: transaction-table-responsive

## Overview

The transactions page currently renders a full HTML `<Table>` at all viewport sizes, causing horizontal overflow on mobile. This design refactors `app/transactions/page.tsx` to use a **dual-layout strategy**: the existing table is preserved for desktop (≥ 768px) and a new `TransactionCard` component is rendered as a stacked list on mobile (< 768px). Visibility is controlled entirely via Tailwind's `md` breakpoint — no JavaScript viewport detection is needed.

The change is additive: existing desktop behavior, sort state, and pagination logic are untouched. The only structural additions are:
1. A `TransactionCard` component extracted to `components/transactions/transaction-card.tsx`
2. A card list container rendered alongside (not replacing) the existing table
3. An `overflow-x-auto` wrapper around the table to contain any residual overflow

---

## Architecture

The page remains a single `'use client'` Next.js page component. State management (`transactions`, `page`, `sortBy`, `order`, `loading`) is unchanged. The render tree gains two sibling branches inside the existing non-empty content block:

```
TransactionsPage
├── Header (back button + title)
├── Loading state
├── Empty state
└── Content block (transactions exist)
    ├── Sort controls — mobile only (block md:hidden)
    ├── Card list — mobile only (block md:hidden)
    │   └── TransactionCard × N
    ├── Table wrapper — desktop only (hidden md:block)
    │   └── overflow-x-auto div
    │       └── <Table> (existing, unchanged)
    └── Pagination (shared, always rendered when totalPages > 1)
```

The pagination block is rendered once and visible at all breakpoints — no duplication needed since it already fits on small screens.

---

## Components and Interfaces

### TransactionCard

**Location:** `components/transactions/transaction-card.tsx`

Extracted as a separate file to keep the page lean and make the card independently testable.

```tsx
interface TransactionCardProps {
  transaction: Transaction;
}
```

**Always-visible fields:**
- Amount — `{amount.toFixed(2)} XLM`, monospace, prominent
- Status — `<Badge variant={statusVariant[status] ?? 'secondary'}>`
- Date — `new Date(createdAt).toLocaleDateString()`
- Circle — `<Link href={/circles/${circle.id}}>{circle.name}</Link>`

**Behind "Show more" toggle:**
- Round — `#{round}`

The toggle uses a local `useState<boolean>` (`expanded`) and renders a small ghost `<Button>` with chevron icon. This keeps the card compact by default while still exposing all data.

**Card root classes:** `p-4 space-y-2 rounded-lg shadow-sm border bg-card`

### Sort Controls (mobile)

Rendered inline in the page above the card list, inside a `block md:hidden` div. Two `<Button variant="outline" size="sm">` elements reuse the existing `toggleSort` function — no new state needed.

```tsx
<div className="block md:hidden flex gap-2 mb-4">
  <Button variant="outline" size="sm" onClick={() => toggleSort('createdAt')}>
    Date <ArrowUpDown className="ml-1 h-3 w-3" />
  </Button>
  <Button variant="outline" size="sm" onClick={() => toggleSort('amount')}>
    Amount <ArrowUpDown className="ml-1 h-3 w-3" />
  </Button>
</div>
```

Active sort column gets a visual indicator (e.g. `bg-accent` or `font-semibold`) so the user knows which sort is active.

### Table Wrapper

The existing `<div className="rounded-md border">` is replaced with:

```tsx
<div className="hidden md:block">
  <div className="rounded-md border overflow-x-auto">
    <Table>...</Table>
  </div>
</div>
```

`overflow-x-auto` on the inner div confines any table overflow to that element, preventing body-level horizontal scroll.

---

## Data Models

No new data models. The existing `Transaction` interface is reused as-is:

```ts
interface Transaction {
  id: string;
  amount: number;
  round: number;
  status: string;
  createdAt: string;
  circle: { id: string; name: string };
}
```

The `statusVariant` mapping is moved to a shared location or kept in the page and imported by `TransactionCard`:

```ts
const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  COMPLETED: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
};
```

Since `TransactionCard` needs this mapping, it will be co-located in `transaction-card.tsx` (or exported from the page and imported — co-location is simpler).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: TransactionCard renders all required fields correctly

*For any* valid `Transaction` object, the rendered `TransactionCard` should contain:
- the amount formatted as `{amount.toFixed(2)} XLM`
- the date formatted with `toLocaleDateString()`
- the circle name as a link with `href="/circles/{circle.id}"`
- the status as a `Badge` with the variant from `statusVariant`

**Validates: Requirements 3.2, 3.3, 3.4, 3.5**

### Property 2: Round field is hidden by default and revealed on toggle

*For any* `TransactionCard`, the Round field (`#{round}`) should not be visible in the initial render, and after the "Show more" button is clicked, the Round field should become visible.

**Validates: Requirements 3.6, 3.8**

### Property 3: Sort toggle state transitions are correct

*For any* current sort state `(sortBy, order)`, calling `toggleSort(col)` should:
- if `col === sortBy`: flip `order` between `'asc'` and `'desc'`
- if `col !== sortBy`: set `sortBy = col` and reset `order = 'desc'`
- always reset `page` to `1`

**Validates: Requirements 1.3, 5.2**

### Property 4: Card list renders one card per transaction

*For any* non-empty array of transactions, the card list container should render exactly as many `TransactionCard` elements as there are transactions in the array.

**Validates: Requirements 2.1**

---

## Error Handling

No new error paths are introduced. The existing silent-catch pattern in `fetchTransactions` is preserved. `TransactionCard` receives only validated data from the already-fetched response, so no additional null-guards are needed beyond the existing `statusVariant[tx.status] ?? 'secondary'` fallback.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are used. Unit tests cover specific examples and DOM structure checks; property tests verify universal behavioral invariants.

**Property-based testing library:** `fast-check` (already compatible with Vitest/Jest in Next.js projects)

### Unit Tests (examples and DOM checks)

- Table wrapper has class `hidden md:block` and inner div has `overflow-x-auto` (Req 1.2, 4.2)
- Card list container has class `block md:hidden` (Req 2.2)
- `TransactionCard` root element has classes `p-4 space-y-2 rounded-lg shadow-sm` (Req 3.7)
- Sort controls are present in the DOM above the card list (Req 5.1)
- Pagination renders "Page X of Y" text when `totalPages > 1` (Req 6.1, 6.2)

### Property-Based Tests

Each test runs a minimum of **100 iterations** via `fast-check`.

**Property 1: TransactionCard field rendering**
```
// Feature: transaction-table-responsive, Property 1: TransactionCard renders all required fields correctly
fc.assert(fc.property(arbitraryTransaction, (tx) => {
  const { getByText, getByRole } = render(<TransactionCard transaction={tx} />);
  expect(getByText(`${tx.amount.toFixed(2)} XLM`)).toBeInTheDocument();
  expect(getByText(new Date(tx.createdAt).toLocaleDateString())).toBeInTheDocument();
  expect(getByRole('link', { name: tx.circle.name })).toHaveAttribute('href', `/circles/${tx.circle.id}`);
}));
```

**Property 2: Show more toggle**
```
// Feature: transaction-table-responsive, Property 2: Round field is hidden by default and revealed on toggle
fc.assert(fc.property(arbitraryTransaction, (tx) => {
  const { queryByText, getByText, getByRole } = render(<TransactionCard transaction={tx} />);
  expect(queryByText(`#${tx.round}`)).not.toBeInTheDocument();
  fireEvent.click(getByRole('button', { name: /show more/i }));
  expect(getByText(`#${tx.round}`)).toBeInTheDocument();
}));
```

**Property 3: Sort toggle state transitions**
```
// Feature: transaction-table-responsive, Property 3: Sort toggle state transitions are correct
fc.assert(fc.property(
  fc.constantFrom('createdAt', 'amount'),
  fc.constantFrom('createdAt', 'amount'),
  fc.constantFrom('asc', 'desc'),
  (currentSortBy, toggleCol, currentOrder) => {
    // pure function test of toggleSort logic
    const result = computeNextSortState(currentSortBy, currentOrder, toggleCol);
    if (toggleCol === currentSortBy) {
      expect(result.order).toBe(currentOrder === 'asc' ? 'desc' : 'asc');
      expect(result.sortBy).toBe(currentSortBy);
    } else {
      expect(result.sortBy).toBe(toggleCol);
      expect(result.order).toBe('desc');
    }
    expect(result.page).toBe(1);
  }
));
```

**Property 4: Card list count matches transaction array**
```
// Feature: transaction-table-responsive, Property 4: Card list renders one card per transaction
fc.assert(fc.property(fc.array(arbitraryTransaction, { minLength: 1, maxLength: 50 }), (txs) => {
  const { getAllByTestId } = render(<CardList transactions={txs} />);
  expect(getAllByTestId('transaction-card')).toHaveLength(txs.length);
}));
```
