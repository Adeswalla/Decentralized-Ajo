# Requirements Document

## Introduction

The TransactionTable component in `app/transactions/page.tsx` currently renders a full HTML table for all viewport sizes, causing horizontal scrolling on mobile devices. This feature refactors the component to be fully responsive: preserving the existing table layout on desktop (≥ 768px) while replacing it with a stacked card layout on mobile (< 768px). A reusable `TransactionCard` component will be extracted to keep the logic DRY.

## Glossary

- **TransactionsPage**: The Next.js page component at `app/transactions/page.tsx` that fetches and displays a paginated, sortable list of transactions.
- **TransactionTable**: The `<Table>` element within `TransactionsPage` that renders transaction rows on desktop viewports.
- **TransactionCard**: A new reusable React component that renders a single transaction as a stacked card for mobile viewports.
- **Transaction**: A data object with fields `id`, `amount`, `round`, `status`, `createdAt`, and `circle` (`id`, `name`).
- **Mobile_Viewport**: A browser viewport with a width less than 768px.
- **Desktop_Viewport**: A browser viewport with a width of 768px or greater.
- **Tailwind_Breakpoint**: The `md` Tailwind CSS breakpoint, which activates at 768px.

## Requirements

### Requirement 1: Desktop Table Layout Preserved

**User Story:** As a desktop user, I want to see the existing table layout with sortable columns, so that I can scan and sort my transaction history efficiently.

#### Acceptance Criteria

1. WHILE on a Desktop_Viewport, THE TransactionTable SHALL render all five columns: Date, Circle, Round, Status, and Amount.
2. WHILE on a Desktop_Viewport, THE TransactionTable SHALL apply the Tailwind class `hidden md:table` so it is hidden on Mobile_Viewport and visible on Desktop_Viewport.
3. WHILE on a Desktop_Viewport, THE TransactionsPage SHALL preserve the existing sort toggle behavior for the Date and Amount columns.
4. WHILE on a Desktop_Viewport, THE TransactionsPage SHALL preserve the existing pagination controls.

### Requirement 2: Mobile Card Layout

**User Story:** As a mobile user, I want each transaction displayed as a readable card, so that I can view my transaction history without horizontal scrolling.

#### Acceptance Criteria

1. WHILE on a Mobile_Viewport, THE TransactionsPage SHALL render a list of TransactionCard components instead of the TransactionTable.
2. WHILE on a Mobile_Viewport, THE TransactionsPage SHALL apply the Tailwind class `block md:hidden` to the card list container so it is visible on Mobile_Viewport and hidden on Desktop_Viewport.
3. THE TransactionsPage SHALL produce no horizontal scroll on a Mobile_Viewport at any standard screen width (320px and above).

### Requirement 3: TransactionCard Component

**User Story:** As a developer, I want a reusable TransactionCard component, so that the mobile card rendering logic is encapsulated and testable independently.

#### Acceptance Criteria

1. THE TransactionCard SHALL accept a single `transaction` prop of type `Transaction`.
2. THE TransactionCard SHALL display the transaction Amount formatted as `{amount.toFixed(2)} XLM`.
3. THE TransactionCard SHALL display the transaction Status as a `Badge` using the existing `statusVariant` mapping.
4. THE TransactionCard SHALL display the transaction Date formatted with `toLocaleDateString()`.
5. THE TransactionCard SHALL display the Circle name as a link navigating to `/circles/{circle.id}`.
6. THE TransactionCard SHALL display the Round number prefixed with `#`.
7. THE TransactionCard SHALL apply card styling: padding `p-4`, vertical spacing `space-y-2`, rounded corners `rounded-lg`, and a subtle shadow `shadow-sm`.
8. WHERE a "Show more" toggle is included, THE TransactionCard SHALL expand to reveal the Round field and any additional non-essential fields on user interaction.

### Requirement 4: No Horizontal Scrolling

**User Story:** As a mobile user, I want the page to fit within my screen width, so that I never need to scroll horizontally to read transaction data.

#### Acceptance Criteria

1. THE TransactionsPage SHALL NOT render any element that causes the document body to overflow horizontally on a Mobile_Viewport.
2. WHEN the TransactionTable is rendered, THE TransactionsPage SHALL wrap it in a container that confines overflow to the table element itself and does not propagate to the page body.

### Requirement 5: Sorting Controls on Mobile

**User Story:** As a mobile user, I want to be able to sort my transactions, so that I can find specific entries without switching to desktop.

#### Acceptance Criteria

1. WHILE on a Mobile_Viewport, THE TransactionsPage SHALL render sort controls (by Date and by Amount) above the card list.
2. WHEN a sort control is activated, THE TransactionsPage SHALL re-fetch and re-render the TransactionCard list in the updated sort order.

### Requirement 6: Pagination on Mobile

**User Story:** As a mobile user, I want pagination controls to be accessible, so that I can navigate through all my transactions on a small screen.

#### Acceptance Criteria

1. WHILE on a Mobile_Viewport and total pages exceed 1, THE TransactionsPage SHALL render Previous and Next pagination buttons below the card list.
2. THE TransactionsPage SHALL display the current page and total pages on Mobile_Viewport in the same format as on Desktop_Viewport.
