# Requirements Document

## Introduction

This feature covers a targeted WCAG 2.1 AA accessibility improvement pass on the authentication flows, circle creation form, profile form, and governance dialogs. The goal is to ensure keyboard and screen-reader users can fully interact with these surfaces: all form fields are correctly labelled and announce validation errors, all interactive elements are reachable via keyboard, and dialogs manage focus correctly.

## Glossary

- **Auth_Form**: The login and registration forms located at `app/auth/login/page.tsx` and `app/auth/register/page.tsx`.
- **Circle_Form**: The circle creation form at `app/circles/create/page.tsx`.
- **Profile_Form**: The profile editing form in `components/profile-form.tsx`.
- **Governance_Dialog**: The create-proposal dialog in `components/governance/create-proposal-dialog.tsx`.
- **Dialog**: Any modal dialog rendered via `components/ui/dialog.tsx` (Radix-based) or `components/modal.tsx` (custom).
- **Field**: An interactive form control — `<input>`, `<textarea>`, or `<select>`.
- **Error_Region**: A DOM element that holds a field-level validation message.
- **axe**: The axe-core accessibility rules engine used for automated auditing.
- **Focus_Ring**: The visible outline rendered on a focused interactive element.
- **Screen_Reader**: Assistive technology that reads page content aloud (e.g. NVDA, VoiceOver).

---

## Requirements

### Requirement 1: Field Error Announcement

**User Story:** As a screen-reader user, I want validation errors to be announced when I submit a form or leave an invalid field, so that I understand what needs to be corrected without relying on visual cues.

#### Acceptance Criteria

1. WHEN a Field fails validation, THE Auth_Form SHALL set `aria-invalid="true"` on that Field.
2. WHEN a Field fails validation, THE Auth_Form SHALL set `aria-describedby` on that Field to reference the associated Error_Region.
3. WHEN a Field fails validation, THE Circle_Form SHALL set `aria-invalid="true"` on that Field.
4. WHEN a Field fails validation, THE Circle_Form SHALL set `aria-describedby` on that Field to reference the associated Error_Region.
5. WHEN a Field fails validation, THE Profile_Form SHALL set `aria-invalid="true"` on that Field.
6. WHEN a Field fails validation, THE Profile_Form SHALL set `aria-describedby` on that Field to reference the associated Error_Region.
7. WHEN a Field fails validation, THE Governance_Dialog SHALL set `aria-invalid="true"` on that Field.
8. WHEN a Field fails validation, THE Governance_Dialog SHALL set `aria-describedby` on that Field to reference the associated Error_Region.
9. WHEN a Field passes validation after previously failing, THE Auth_Form SHALL remove `aria-invalid` or set it to `"false"` on that Field.
10. WHEN a Field passes validation after previously failing, THE Circle_Form SHALL remove `aria-invalid` or set it to `"false"` on that Field.
11. WHEN a Field passes validation after previously failing, THE Profile_Form SHALL remove `aria-invalid` or set it to `"false"` on that Field.
12. WHEN a Field passes validation after previously failing, THE Governance_Dialog SHALL remove `aria-invalid` or set it to `"false"` on that Field.

---

### Requirement 2: Error Region Accessibility

**User Story:** As a screen-reader user, I want error messages to be programmatically associated with their fields, so that my screen reader reads the error when I focus the field.

#### Acceptance Criteria

1. THE Auth_Form SHALL render each Error_Region with a unique `id` attribute that matches the `aria-describedby` value of its associated Field.
2. THE Circle_Form SHALL render each Error_Region with a unique `id` attribute that matches the `aria-describedby` value of its associated Field.
3. THE Profile_Form SHALL render each Error_Region with a unique `id` attribute that matches the `aria-describedby` value of its associated Field.
4. THE Governance_Dialog SHALL render each Error_Region with a unique `id` attribute that matches the `aria-describedby` value of its associated Field.
5. WHILE a Field has no validation error, THE Auth_Form SHALL render the associated Error_Region as empty or absent from the DOM so that no stale message is announced.
6. WHILE a Field has no validation error, THE Circle_Form SHALL render the associated Error_Region as empty or absent from the DOM so that no stale message is announced.
7. WHILE a Field has no validation error, THE Profile_Form SHALL render the associated Error_Region as empty or absent from the DOM so that no stale message is announced.
8. WHILE a Field has no validation error, THE Governance_Dialog SHALL render the associated Error_Region as empty or absent from the DOM so that no stale message is announced.

---

### Requirement 3: Visible Focus Rings

**User Story:** As a keyboard user, I want a clearly visible focus indicator on every interactive element, so that I always know which element has keyboard focus.

#### Acceptance Criteria

1. THE Auth_Form SHALL render a Focus_Ring with a minimum CSS outline width of 2px on every focused Field and button.
2. THE Circle_Form SHALL render a Focus_Ring with a minimum CSS outline width of 2px on every focused Field and button.
3. THE Profile_Form SHALL render a Focus_Ring with a minimum CSS outline width of 2px on every focused Field and button.
4. THE Governance_Dialog SHALL render a Focus_Ring with a minimum CSS outline width of 2px on every focused Field and button.
5. THE Dialog SHALL render a Focus_Ring with a minimum CSS outline width of 2px on every focused interactive element within the dialog.
6. IF a global CSS rule sets `outline: none` or `outline: 0` on `:focus`, THEN THE application SHALL provide an equivalent `:focus-visible` replacement that meets the 2px minimum.

---

### Requirement 4: Keyboard Navigation — Forms

**User Story:** As a keyboard user, I want to navigate all form fields and submit actions using only the keyboard, so that I can complete forms without a mouse.

#### Acceptance Criteria

1. THE Auth_Form SHALL make every Field and submit button reachable via sequential Tab key navigation.
2. THE Circle_Form SHALL make every Field and submit button reachable via sequential Tab key navigation.
3. THE Profile_Form SHALL make every Field and submit button reachable via sequential Tab key navigation.
4. THE Governance_Dialog SHALL make every Field and submit button reachable via sequential Tab key navigation.
5. WHEN the Tab key is pressed on the last focusable element in the Auth_Form, THE Auth_Form SHALL move focus to the first focusable element in the natural document order outside the form.
6. WHEN the Tab key is pressed on the last focusable element in the Governance_Dialog, THE Governance_Dialog SHALL cycle focus back to the first focusable element within the Dialog (focus trap).

---

### Requirement 5: Dialog Focus Management

**User Story:** As a keyboard user, I want focus to move into a dialog when it opens and return to the trigger element when it closes, so that I do not lose my place in the page.

#### Acceptance Criteria

1. WHEN a Dialog opens, THE Dialog SHALL move focus to the first focusable element inside the dialog.
2. WHEN a Dialog closes, THE Dialog SHALL return focus to the element that triggered the dialog to open.
3. WHILE a Dialog is open, THE Dialog SHALL confine Tab and Shift+Tab navigation to focusable elements within the dialog.
4. WHEN the Escape key is pressed while a Dialog is open, THE Dialog SHALL close the dialog.
5. WHEN the backdrop of a Dialog is clicked while the Dialog is open, THE Dialog SHALL close the dialog.

---

### Requirement 6: Automated Audit Compliance

**User Story:** As a developer, I want automated axe scans to pass on targeted routes, so that I have a repeatable baseline to prevent regressions.

#### Acceptance Criteria

1. WHEN axe is run against the `/auth/login` route, THE application SHALL produce zero critical or serious axe violations.
2. WHEN axe is run against the `/auth/register` route, THE application SHALL produce zero critical or serious axe violations.
3. WHEN axe is run against the `/circles/create` route, THE application SHALL produce zero critical or serious axe violations.
4. WHEN axe is run against any route that renders the Governance_Dialog, THE application SHALL produce zero critical or serious axe violations related to the dialog.
5. WHEN axe is run against any route that renders the Profile_Form, THE application SHALL produce zero critical or serious axe violations related to the form.
6. IF a known axe violation cannot be resolved within the scope of this pass, THEN THE team SHALL document the exception with a justification in the associated pull request.

---

### Requirement 7: Input Component ARIA Propagation

**User Story:** As a developer, I want the shared Input component to forward ARIA attributes to the underlying `<input>` element, so that consuming forms can wire up accessibility attributes without duplicating logic.

#### Acceptance Criteria

1. THE Input_Component SHALL accept and forward `aria-invalid`, `aria-describedby`, and `aria-label` props to the underlying `<input>` element.
2. WHEN `aria-invalid="true"` is passed to the Input_Component, THE Input_Component SHALL apply the error styling defined in its CSS variant.
3. THE Governance_Dialog SHALL replace its raw `<input>`, `<textarea>`, and `<select>` elements with the shared Input_Component or equivalent shadcn/ui components that support ARIA prop forwarding.
