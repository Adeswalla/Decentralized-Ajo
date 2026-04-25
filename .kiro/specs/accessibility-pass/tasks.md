# Implementation Plan: Accessibility Pass (WCAG 2.1 AA)

## Overview

Surgical ARIA wiring across auth forms, circle form, profile form, and governance dialog. Migrate governance dialog from raw elements to shared components. Audit global CSS for focus ring suppression. Add property-based and axe audit tests.

## Tasks

- [x] 1. Audit and document `components/ui/input.tsx` ARIA prop forwarding
  - Verify `...props` spread is unconditional and reaches the underlying `<input>`
  - Add a JSDoc comment documenting the expected `aria-invalid`, `aria-describedby`, `aria-label` usage contract
  - _Requirements: 7.1, 7.2_

  - [x]* 1.1 Write property test for Input ARIA forwarding (P5)
    - **Property 5: Input component forwards ARIA props to the underlying element**
    - **Validates: Requirements 7.1, 7.2**
    - File: `__tests__/accessibility/input-component.property.test.tsx`
    - Use `fc.string()` for `aria-describedby`, `fc.boolean()` for `aria-invalid`, minimum 100 iterations

- [ ] 2. Wire ARIA attributes in auth forms
  - [x] 2.1 Update `app/auth/login/page.tsx`
    - Add `aria-invalid={!!errors[fieldName]}` to each `<Input>`
    - Add `aria-describedby={errors[fieldName] ? \`${fieldName}-error\` : undefined}` to each `<Input>`
    - Add `id={\`${fieldName}-error\`}` and `role="alert"` to each error `<p>`
    - _Requirements: 1.1, 1.2, 1.9, 2.1, 2.5_

  - [x] 2.2 Update `app/auth/register/page.tsx`
    - Same ARIA wiring pattern as login for all validated fields
    - _Requirements: 1.1, 1.2, 1.9, 2.1, 2.5_

  - [ ]* 2.3 Write property tests for auth form ARIA wiring (P1–P3)
    - **Property 1: Invalid fields carry matching ARIA error references**
    - **Property 2: Clearing a validation error removes aria-invalid**
    - **Property 3: No stale error regions when field is valid**
    - **Validates: Requirements 1.1, 1.2, 1.9, 2.1, 2.5**
    - File: `__tests__/accessibility/aria-wiring.property.test.tsx`
    - Use `fc.string()` for field name, `fc.string({ minLength: 1 })` for error message

- [x] 3. Wire ARIA attributes in circle creation form
  - Update `app/circles/create/page.tsx` for fields: `name`, `contributionAmount`, `contributionFrequencyDays`, `maxRounds`
  - Add `aria-invalid`, `aria-describedby` to each `<Input>`
  - Add `id` and `role="alert"` to each error `<p>`
  - Skip `description` textarea (no validation)
  - _Requirements: 1.3, 1.4, 1.10, 2.2, 2.6_

  - [ ]* 3.1 Extend property tests to cover circle form (P1–P3)
    - **Property 1, 2, 3** applied to circle form fields
    - **Validates: Requirements 1.3, 1.4, 1.10, 2.2, 2.6**
    - Add cases to `__tests__/accessibility/aria-wiring.property.test.tsx`

- [x] 4. Wire ARIA attributes in profile form
  - Update `components/profile-form.tsx` for fields: `firstName`, `lastName`, `username`, `notificationEmail`, `bio`
  - After `{...register('fieldName')}` spread, add `aria-invalid={!!errors.fieldName}` and `aria-describedby`
  - Add `id` and `role="alert"` to each `errors.fieldName.message` paragraph
  - _Requirements: 1.5, 1.6, 1.11, 2.3, 2.7_

  - [ ]* 4.1 Extend property tests to cover profile form (P1–P3)
    - **Property 1, 2, 3** applied to profile form fields
    - **Validates: Requirements 1.5, 1.6, 1.11, 2.3, 2.7**
    - Add cases to `__tests__/accessibility/aria-wiring.property.test.tsx`

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Migrate governance dialog to shared components and wire ARIA
  - [x] 6.1 Convert `error: string` state to `errors: Record<string, string>` in `components/governance/create-proposal-dialog.tsx`
    - Replace `const [error, setError] = useState('')` with `useState<Record<string, string>>({})`
    - Refactor `handleSubmit` validation to populate per-field keys instead of a single string
    - Preserve the existing catch block as a form-level error region
    - _Requirements: 1.7, 1.8, 1.12, 2.4, 2.8_

  - [x] 6.2 Replace raw `<input>` and `<textarea>` elements with shared components
    - Replace raw `<input>` with `<Input>` from `components/ui/input.tsx`
    - Replace raw `<textarea>` with `<Textarea>` from `components/ui/textarea.tsx`
    - Leave `<select>` and `<input type="range">` as-is (no validation, no ARIA wiring needed)
    - _Requirements: 7.3_

  - [x] 6.3 Wire `aria-invalid`, `aria-describedby`, and error `<p>` elements for each validated field
    - Add `id` and `role="alert"` to each per-field error paragraph
    - _Requirements: 1.7, 1.8, 2.4, 2.8_

  - [ ]* 6.4 Extend property tests to cover governance dialog (P1–P4)
    - **Property 1, 2, 3** applied to governance dialog fields
    - **Property 4: All interactive form elements are keyboard-reachable**
    - **Validates: Requirements 1.7, 1.8, 2.4, 2.8, 4.4**
    - Add cases to `__tests__/accessibility/aria-wiring.property.test.tsx`

- [x] 7. Audit global CSS for focus ring suppression
  - Open `app/globals.css` and search for `outline: none` or `outline: 0` on `:focus` selectors
  - If found without a `:focus-visible` replacement, add an equivalent `:focus-visible` rule with minimum 2px outline
  - Verify `components/ui/input.tsx` retains `focus-visible:ring-[3px]` (already present)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 8. Write dialog focus management tests
  - Create `__tests__/accessibility/dialog-focus.test.tsx`
  - Test: dialog open → focus moves to first focusable element inside
  - Test: dialog close → focus returns to trigger element
  - Test: Escape key closes dialog
  - Test: backdrop click closes dialog
  - Test: Tab/Shift+Tab stays within dialog while open
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Write axe audit tests
  - Create `__tests__/accessibility/axe-audit.test.tsx`
  - Configure axe to filter `wcag2a` and `wcag2aa` tags, assert zero critical/serious violations
  - Add test cases for: login form, register form, circle creation form, governance dialog, profile form
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use fast-check with a minimum of 100 iterations each
- axe tests use jest-axe; filter to `impact === 'critical' || 'serious'` only
- Dialog focus management (Radix `dialog.tsx` and `modal.tsx`) requires no code changes — tests verify existing behavior
