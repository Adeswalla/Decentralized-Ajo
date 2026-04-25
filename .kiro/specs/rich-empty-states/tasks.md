# Implementation Plan: Rich Empty States

## Overview

Replace the ad-hoc inline empty-state markup across the Dashboard, Transactions page, and Circles browser with six consistent, accessible, theme-aware variant components built on the existing `Empty` component family. All changes are purely presentational — no new API routes or data-fetching hooks are introduced.

## Tasks

- [x] 1. Extend `EmptyTitle` in `components/ui/empty.tsx` to render as a semantic heading
  - Change the `EmptyTitle` inner element from `<div>` to `<h3>` and update its `React.ComponentProps` type accordingly
  - Keep all existing class names and `data-slot` attribute unchanged so the visual output is identical
  - This is a non-breaking change — all existing usages continue to work
  - _Requirements: 1.1, 1.2, 10.3_

- [x] 2. Create `components/ui/empty-states.tsx` with all six variant components
  - [x] 2.1 Implement `UnauthenticatedDashboardEmpty`
    - Props: `onConnect: () => void`, `isConnecting?: boolean`
    - Icon: `Wallet` with `aria-hidden="true"`
    - Title: "Connect Your Wallet"
    - Description: "Connect your Stellar wallet to view your Ajo groups, pooled balances, and upcoming payment cycles."
    - CTA: "Connect Wallet" button that calls `onConnect`; when `isConnecting` is true, show loading text and set `aria-disabled="true"` and `aria-busy="true"` on the button
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.1–9.5, 10.1, 10.2, 10.3, 10.4_

  - [x] 2.2 Implement `NoActiveGroupsEmpty`
    - No props required
    - Icon: `Users` with `aria-hidden="true"`
    - Title: "No Active Groups"
    - Description: "You haven't joined any active Ajo circles yet. Create or join one to get started."
    - Primary CTA: `<Link href="/circles/join">` labelled "Find Ajo Groups"
    - Secondary CTA: `<Link href="/circles/create">` labelled "Create a Circle"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.1–9.5, 10.1, 10.2, 10.3_

  - [x] 2.3 Implement `NoUserAjosEmpty`
    - No props required
    - Icon: `CircleDot` with `aria-hidden="true"`
    - Title: "No Ajo Groups Yet"
    - Description: "You haven't joined any Ajo groups. Browse available groups to get started."
    - CTA: `<Link href="/circles/join">` labelled "Browse Ajos"
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.1–9.5, 10.1, 10.2, 10.3_

  - [x] 2.4 Implement `NoCirclesFilteredEmpty`
    - Props: `onClearFilters: () => void`
    - Icon: `SearchX` with `aria-hidden="true"`
    - Title: "No circles found"
    - Description: "No circles match your current search or filter. Try adjusting your criteria."
    - CTA: "Clear filters" button that calls `onClearFilters`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.1–9.5, 10.1, 10.2, 10.3_

  - [x] 2.5 Implement `NoCirclesAllEmpty`
    - No props required
    - Icon: `LayoutGrid` with `aria-hidden="true"`
    - Title: "No circles yet"
    - Description: "There are no circles to browse. Create one or join an existing circle to get started."
    - Primary CTA: `<Link href="/circles/create">` labelled "Create a Circle"
    - Secondary CTA: `<Link href="/circles/join">` labelled "Join a Circle"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.1–9.5, 10.1, 10.2, 10.3_

  - [x] 2.6 Implement `NoTransactionsEmpty`
    - No props required
    - Icon: `Receipt` with `aria-hidden="true"`
    - Title: "No transactions yet"
    - Description: "Your contributions will appear here once you join a circle and make a payment."
    - CTA: `<Link href="/circles/join">` labelled "Join a Circle"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1–9.5, 10.1, 10.2, 10.3_

- [x] 3. Extend `CircleList` props and wire up conditional empty states
  - Add `searchQuery?: string`, `statusFilter?: string`, and `onClearFilters?: () => void` to the `CircleListProps` interface in `components/dashboard/circle-list.tsx`
  - Implement the `hasActiveFilters` check: `(searchQuery?.trim().length ?? 0) > 0 || (statusFilter !== '' && statusFilter !== 'ALL')`
  - Replace the existing single inline empty-state block with a conditional: render `<NoCirclesFilteredEmpty onClearFilters={onClearFilters ?? (() => {})} />` when `hasActiveFilters` is true, and `<NoCirclesAllEmpty />` when false
  - Import both variants from `components/ui/empty-states.tsx`
  - _Requirements: 6.1, 6.6, 7.1_

- [x] 4. Update `app/dashboard/page.tsx` to pass filter props to `CircleList` and use `NoUserAjosEmpty`
  - Pass `searchQuery={search}`, `statusFilter={statusFilter}`, and `onClearFilters` callback to the `<CircleList>` component (the callback should reset `search` to `''` and `statusFilter` to `''`)
  - Replace the inline "no ajos" `<div>` block (the `userAjos.length === 0` branch) with `<NoUserAjosEmpty />`
  - Import `NoUserAjosEmpty` from `components/ui/empty-states.tsx`
  - _Requirements: 5.1–5.5_

- [x] 5. Update `components/dashboard.tsx` to use `UnauthenticatedDashboardEmpty` and `NoActiveGroupsEmpty`
  - Replace the `!isConnected` return block's inline markup with `<UnauthenticatedDashboardEmpty onConnect={connectWallet} isConnecting={isLoading} />`
  - Replace the `activeGroups.length === 0` inline block with `<NoActiveGroupsEmpty />`
  - Remove the now-unused `Wallet`, `Info` Lucide imports and any other imports made redundant by the swap
  - Import both variants from `components/ui/empty-states.tsx`
  - _Requirements: 3.1–3.6, 4.1–4.6_

- [-] 6. Update `app/transactions/page.tsx` to use `NoTransactionsEmpty`
  - Replace the `transactions.length === 0` inline `<div>` block with `<NoTransactionsEmpty />`
  - Import `NoTransactionsEmpty` from `components/ui/empty-states.tsx`
  - _Requirements: 8.1–8.5_

- [~] 7. Checkpoint — verify the application compiles and all surfaces render correctly
  - Run `tsc --noEmit` (or the project's type-check script) to confirm no TypeScript errors
  - Ensure all six empty state surfaces are reachable and render without console errors
  - Ask the user if any questions arise before proceeding to tests

- [~] 8. Write tests in `components/ui/empty-states.test.tsx`
  - [~] 8.1 Write example-based unit tests for all six variant components
    - `UnauthenticatedDashboardEmpty`: correct title, description, CTA label; clicking CTA calls `onConnect`; with `isConnecting=true`, button has `aria-disabled="true"` and `aria-busy="true"`
    - `NoActiveGroupsEmpty`: correct title, description, "Find Ajo Groups" link to `/circles/join`, "Create a Circle" link to `/circles/create`
    - `NoUserAjosEmpty`: correct title, description, "Browse Ajos" link to `/circles/join`
    - `NoCirclesFilteredEmpty`: correct title, description, "Clear filters" button; clicking calls `onClearFilters`
    - `NoCirclesAllEmpty`: correct title, description, "Create a Circle" link, "Join a Circle" link
    - `NoTransactionsEmpty`: correct title, description, "Join a Circle" link to `/circles/join`
    - Copy constraints: for each variant, assert title word count ≤ 5 and description word count ≤ 25
    - Keyboard navigation: use `@testing-library/user-event` to Tab to each CTA and activate with Enter/Space
    - `CircleList` integration: renders `NoCirclesFilteredEmpty` when `circles=[]` and `searchQuery="test"`; renders `NoCirclesAllEmpty` when `circles=[]` and no filters active
    - _Requirements: 3.1–3.6, 4.1–4.6, 5.1–5.5, 6.1–6.6, 7.1–7.6, 8.1–8.5, 9.1–9.5, 10.1, 10.4_

  - [ ]* 8.2 Write property test for Property 1: filter state determines empty state variant and CTA visibility
    - Use `fc.record({ searchQuery: fc.string(), statusFilter: fc.constantFrom('', 'ALL', 'ACTIVE', 'PENDING', 'COMPLETED') })` to generate filter combinations
    - For each combination, render `CircleList` with `circles=[]` and assert: if `hasActiveFilters` → "No circles found" title present and "Clear filters" button present; if `!hasActiveFilters` → "No circles yet" title present and "Clear filters" button absent
    - Run minimum 100 iterations
    - Tag: `// Feature: rich-empty-states, Property 1: filter state determines empty state variant and CTA visibility`
    - **Property 1: Filter state determines empty state variant and CTA visibility**
    - **Validates: Requirements 6.1, 6.6, 7.1**

  - [ ]* 8.3 Write property test for Property 2: all empty state icons have aria-hidden
    - For each of the six variant components, render the component and query all SVG elements
    - Assert every SVG has `aria-hidden="true"`
    - Tag: `// Feature: rich-empty-states, Property 2: all empty state icons have aria-hidden`
    - **Property 2: All empty state icons have aria-hidden**
    - **Validates: Requirement 10.2**

  - [ ]* 8.4 Write property test for Property 3: all empty state titles are heading elements
    - For each of the six variant components, render the component and query the title element
    - Assert it is an `h2`, `h3`, or has `role="heading"`
    - Tag: `// Feature: rich-empty-states, Property 3: all empty state titles are heading elements`
    - **Property 3: All empty state titles are heading elements**
    - **Validates: Requirement 10.3**

- [~] 9. Final checkpoint — ensure all tests pass
  - Run the full test suite and confirm all tests in `empty-states.test.tsx` pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation before moving to the next phase
- Property tests validate universal correctness properties across arbitrary inputs
- Unit tests validate specific examples, edge cases, and interaction behavior
- The `EmptyTitle` change in Task 1 is non-breaking — existing usages are unaffected
