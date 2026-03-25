# Implementation Plan: transaction-table-responsive

## Overview

Refactor `app/transactions/page.tsx` to use a dual-layout strategy: preserve the existing table for desktop (≥ 768px) and add a stacked `TransactionCard` list for mobile (< 768px). Visibility is controlled via Tailwind's `md` breakpoint — no JS viewport detection needed.

## Tasks

- [x] 1. Extract TransactionCard component
  - [x] 1.1 Create `components/transactions/transaction-card.tsx`
    - Define `TransactionCardProps` with a single `transaction: Transaction` prop
    - Co-locate the `statusVariant` mapping in this file
    - Render Amount (`{amount.toFixed(2)} XLM`), Status (`<Badge>`), Date (`toLocaleDateString()`), and Circle name as a `<Link href="/circles/{circle.id}">`
    - Add local `useState<boolean>` (`expanded`) for the "Show more" toggle
    - Render Round (`#{round}`) only when `expanded === true`
    - Apply root classes: `p-4 space-y-2 rounded-lg shadow-sm border bg-card`
    - Add `data-testid="transaction-card"` to the root element
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 1.2 Write property test for TransactionCard field rendering
    - **Property 1: TransactionCard renders all required fields correctly**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
    - Use `fast-check` arbitrary for `Transaction`; assert amount, date, circle link, and badge are present

  - [ ]* 1.3 Write property test for Show more toggle
    - **Property 2: Round field is hidden by default and revealed on toggle**
    - **Validates: Requirements 3.6, 3.8**
    - Assert `#{round}` absent before click, present after clicking the "Show more" button

- [x] 2. Wrap existing table for desktop-only display
  - [x] 2.1 In `app/transactions/page.tsx`, wrap the existing `<div className="rounded-md border">` in a `<div className="hidden md:block">` outer container
    - Add `overflow-x-auto` to the inner `rounded-md border` div
    - Remove `statusVariant` from the page file (it now lives in `transaction-card.tsx`) or keep it if still needed for the table's `<Badge>` — keep it in the page for the table rows
    - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [x] 3. Add mobile sort controls and card list to TransactionsPage
  - [x] 3.1 Import `TransactionCard` into `app/transactions/page.tsx`
    - Add a `<div className="block md:hidden">` sort controls block above the card list
    - Render two `<Button variant="outline" size="sm">` buttons calling the existing `toggleSort` function for `'createdAt'` and `'amount'`
    - Apply `bg-accent` or `font-semibold` to the active sort button based on current `sortBy`
    - _Requirements: 5.1, 5.2_

  - [x] 3.2 Add the card list container below the sort controls
    - Wrap in `<div className="block md:hidden space-y-3">` 
    - Map `transactions` to `<TransactionCard key={tx.id} transaction={tx} />`
    - _Requirements: 2.1, 2.2_

  - [ ]* 3.3 Write property test for card list count
    - **Property 4: Card list renders one card per transaction**
    - **Validates: Requirements 2.1**
    - Use `fast-check` array arbitrary; assert `getAllByTestId('transaction-card')` length equals input array length

- [x] 4. Verify pagination works at all breakpoints
  - [x] 4.1 Confirm the existing pagination block is outside both the `hidden md:block` and `block md:hidden` containers — it should be a sibling rendered once for all breakpoints
    - No code changes expected; this is a verification + minor structural adjustment if needed
    - _Requirements: 1.4, 6.1, 6.2_

- [x] 5. Checkpoint — run diagnostics and fix TypeScript errors
  - Run `getDiagnostics` on `components/transactions/transaction-card.tsx` and `app/transactions/page.tsx`
  - Fix any type errors, missing imports, or lint warnings before proceeding
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Write sort toggle pure-function helper and property test
  - [ ] 6.1 Extract a pure `computeNextSortState(sortBy, order, col)` helper function (can live at the top of `app/transactions/page.tsx` or in a `lib/` utility)
    - Returns `{ sortBy, order, page: 1 }` following the toggle logic already in `toggleSort`
    - _Requirements: 1.3, 5.2_

  - [ ]* 6.2 Write property test for sort toggle state transitions
    - **Property 3: Sort toggle state transitions are correct**
    - **Validates: Requirements 1.3, 5.2**
    - Use `fast-check` with `fc.constantFrom` for columns and orders; assert flip/reset behavior and page reset to 1

- [ ] 7. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- `statusVariant` stays in the page file for table `<Badge>` usage and is also co-located in `transaction-card.tsx`
- Property tests use `fast-check`; run with `vitest --run` for single execution
