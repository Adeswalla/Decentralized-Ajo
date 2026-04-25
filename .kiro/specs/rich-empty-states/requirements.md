# Requirements Document

## Introduction

This feature replaces bare, unstyled empty states across the three main list views — Dashboard (My Ajos overview), Transactions, and Circles browser — with rich, contextual empty states. Each empty state includes an illustration or icon, clear explanatory copy, and a primary call-to-action (CTA) that guides the user toward the most relevant next step. The goal is to eliminate the perception that blank panels are errors and to reduce friction for new users who have not yet connected a wallet, joined a circle, or made a contribution.

The application is built with Next.js 16 (App Router), React, shadcn/ui, Tailwind CSS 4, and SWR. An existing `Empty` component family (`Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyMedia`, `EmptyContent`) is available in `components/ui/empty.tsx` and must be used or extended rather than replaced.

---

## Glossary

- **Empty_State**: A UI component rendered in place of a list or data panel when that panel has no items to display.
- **Empty_Component**: The existing `components/ui/empty.tsx` component family (`Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyMedia`, `EmptyContent`).
- **Dashboard_View**: The page at `/dashboard` that shows the user's active Ajo overview, "My Ajos" section, and the "Explore More Circles" browser.
- **Transactions_View**: The page at `/app/transactions/page.tsx` that lists a user's contribution history.
- **Circles_View**: The `CircleList` component rendered within the Dashboard_View that shows the browseable list of circles.
- **CTA**: A primary call-to-action button or link that directs the user to the most relevant next step.
- **Wallet**: A Stellar-compatible crypto wallet connected via the application's wallet context.
- **Circle**: A savings group (Ajo) that users can create or join.
- **Theme**: The active color scheme — either light or dark — controlled by the application's theme provider.
- **Unauthenticated_User**: A user who has not connected a Wallet.
- **Authenticated_User**: A user who has connected a Wallet.

---

## Requirements

### Requirement 1: Empty_Component Reuse

**User Story:** As a developer, I want all empty states to use the existing `Empty` component family, so that visual consistency is maintained and no duplicate patterns are introduced.

#### Acceptance Criteria

1. THE Empty_State SHALL be composed using `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyMedia`, and `EmptyContent` sub-components from `components/ui/empty.tsx`.
2. WHEN a new empty state variant is needed that the existing Empty_Component does not support, THE Empty_Component SHALL be extended rather than replaced.
3. THE Empty_Component SHALL render with a dashed border and centered layout as defined by its existing base styles.

---

### Requirement 2: Theme Compatibility

**User Story:** As a user, I want empty states to look correct in both light and dark mode, so that the interface feels polished regardless of my theme preference.

#### Acceptance Criteria

1. THE Empty_State SHALL use only Tailwind CSS semantic color tokens (e.g., `text-muted-foreground`, `bg-muted`, `text-foreground`) rather than hard-coded color values.
2. WHEN the Theme changes from light to dark or dark to light, THE Empty_State SHALL update its colors without a page reload.
3. THE Empty_State SHALL NOT use inline `style` attributes for color properties.

---

### Requirement 3: Dashboard — Unauthenticated Empty State

**User Story:** As a new user who has not connected a wallet, I want to see a clear prompt on the dashboard, so that I understand I need to connect my wallet to access my Ajo groups.

#### Acceptance Criteria

1. WHILE the Unauthenticated_User is on the Dashboard_View, THE Dashboard_View SHALL render an Empty_State in place of the active groups panel.
2. THE Empty_State SHALL display an icon representing a wallet.
3. THE Empty_State SHALL display the title "Connect Your Wallet".
4. THE Empty_State SHALL display a description explaining that connecting a wallet is required to view Ajo groups, pooled balances, and upcoming payment cycles.
5. THE Empty_State SHALL include a CTA button labelled "Connect Wallet" that invokes the wallet connection flow.
6. WHEN the wallet connection is in progress, THE CTA button SHALL display a loading indicator and be disabled.

---

### Requirement 4: Dashboard — No Active Ajo Groups Empty State

**User Story:** As an Authenticated_User who has not joined any active circles, I want to see a helpful prompt in the "My Ajos" panel, so that I know how to get started.

#### Acceptance Criteria

1. WHILE the Authenticated_User is on the Dashboard_View and has zero active Ajo groups, THE Dashboard_View SHALL render an Empty_State in the active groups panel.
2. THE Empty_State SHALL display an icon representing a group or savings circle.
3. THE Empty_State SHALL display the title "No Active Groups".
4. THE Empty_State SHALL display a description explaining that the user has not joined any active Ajo circles yet.
5. THE Empty_State SHALL include a primary CTA button labelled "Find Ajo Groups" that navigates to `/circles/join`.
6. THE Empty_State SHALL include a secondary CTA button labelled "Create a Circle" that navigates to `/circles/create`.

---

### Requirement 5: Dashboard — No "My Ajos" (User Ajos) Empty State

**User Story:** As an Authenticated_User who has not joined any Ajo groups via the on-chain contract, I want to see a helpful prompt in the "My Ajos" section, so that I understand the next step.

#### Acceptance Criteria

1. WHILE the Authenticated_User is on the Dashboard_View and has zero user Ajo groups, THE Dashboard_View SHALL render an Empty_State in the "My Ajos" section.
2. THE Empty_State SHALL display an icon representing a savings group.
3. THE Empty_State SHALL display the title "No Ajo Groups Yet".
4. THE Empty_State SHALL display a description explaining that the user has not joined any Ajo groups.
5. THE Empty_State SHALL include a CTA button labelled "Browse Ajos" that navigates to `/circles/join`.

---

### Requirement 6: Circles_View — No Search Results Empty State

**User Story:** As a user browsing circles, I want to see a clear message when my search or filter returns no results, so that I know the list is empty due to my filters rather than a data error.

#### Acceptance Criteria

1. WHEN the Circles_View receives a `circles` array of length zero and a search query or status filter is active, THE Circles_View SHALL render an Empty_State using the Empty_Component.
2. THE Empty_State SHALL display an icon representing a search or grid.
3. THE Empty_State SHALL display the title "No circles found".
4. THE Empty_State SHALL display a description explaining that no circles match the current search or filter criteria.
5. THE Empty_State SHALL include a CTA button labelled "Clear filters" that resets all active filters and the search query.
6. THE Empty_State SHALL NOT display the CTA button when no filters or search query are active.

---

### Requirement 7: Circles_View — No Circles At All Empty State

**User Story:** As a new user with no circles in the system, I want to see a prompt to create or join a circle, so that I know what to do next.

#### Acceptance Criteria

1. WHEN the Circles_View receives a `circles` array of length zero and no search query or status filter is active, THE Circles_View SHALL render an Empty_State using the Empty_Component.
2. THE Empty_State SHALL display an icon representing a circle or group.
3. THE Empty_State SHALL display the title "No circles yet".
4. THE Empty_State SHALL display a description inviting the user to create or join a circle.
5. THE Empty_State SHALL include a primary CTA button labelled "Create a Circle" that navigates to `/circles/create`.
6. THE Empty_State SHALL include a secondary CTA button labelled "Join a Circle" that navigates to `/circles/join`.

---

### Requirement 8: Transactions_View — No Transactions Empty State

**User Story:** As a user who has not yet made any contributions, I want to see a helpful message on the transactions page, so that I understand why the list is empty and what to do next.

#### Acceptance Criteria

1. WHEN the Transactions_View fetches successfully and the returned `contributions` array has length zero, THE Transactions_View SHALL render an Empty_State using the Empty_Component.
2. THE Empty_State SHALL display an icon representing a transaction or receipt.
3. THE Empty_State SHALL display the title "No transactions yet".
4. THE Empty_State SHALL display a description explaining that contributions will appear here once the user joins a circle and makes a payment.
5. THE Empty_State SHALL include a CTA button labelled "Join a Circle" that navigates to `/circles/join`.

---

### Requirement 9: Copy Tone and Clarity

**User Story:** As a user, I want all empty state copy to be clear, friendly, and action-oriented, so that I feel guided rather than confused.

#### Acceptance Criteria

1. THE Empty_State title SHALL be 5 words or fewer.
2. THE Empty_State description SHALL be 25 words or fewer.
3. THE Empty_State copy SHALL NOT use technical jargon (e.g., "null", "undefined", "404", "fetch error").
4. THE Empty_State CTA label SHALL use an imperative verb (e.g., "Connect", "Create", "Join", "Browse").
5. THE Empty_State SHALL NOT display raw error messages or stack traces to the user.

---

### Requirement 10: Accessibility

**User Story:** As a user relying on assistive technology, I want empty states to be accessible, so that I can understand the context and interact with CTAs using a keyboard or screen reader.

#### Acceptance Criteria

1. THE Empty_State CTA button SHALL be reachable and activatable via keyboard navigation (Tab + Enter/Space).
2. THE Empty_State icon SHALL have `aria-hidden="true"` set so that decorative icons are not announced by screen readers.
3. THE Empty_State title SHALL be rendered as a heading element (`h2` or `h3`) or have an appropriate `role` attribute so that screen readers can identify it as a section heading.
4. WHEN the CTA button is in a loading state, THE CTA button SHALL have `aria-disabled="true"` and `aria-busy="true"` set.
