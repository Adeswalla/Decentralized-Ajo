# Regression Test Suite

**Closes #644**

This directory contains regression tests that cover previously reported bugs and critical business flows. Each test is tagged with the GitHub issue number it prevents regression of.

## Overview

The regression test suite runs nightly via GitHub Actions against the staging environment. Failures trigger immediate alerts to the engineering team via Slack and email.

## Test Coverage

### 1. Reward Double-Issuance Prevention
**File:** `reward-double-issuance.test.ts`  
**Issue:** #XXX (replace with actual issue number)

Tests that rewards cannot be issued twice for the same action. Covers:
- Duplicate reward detection
- Database transaction usage
- Concurrent issuance handling
- Reward amount validation

### 2. Expired Campaign Rejection
**File:** `expired-campaign-rejection.test.ts`  
**Issue:** #XXX (replace with actual issue number)

Tests that expired campaigns are properly rejected. Covers:
- Contribution rejection for expired campaigns
- Campaign activation prevention
- Date range validation
- Status checking

### 3. Unauthorized Access Prevention
**File:** `unauthorized-access.test.ts`  
**Issue:** #XXX (replace with actual issue number)

Tests that unauthorized users cannot access protected resources. Covers:
- Missing authentication token
- Invalid token handling
- Cross-user resource access
- Role-based permissions
- Organizer-only actions

## Running Tests

### Run All Regression Tests
```bash
pnpm test __tests__/regression/
```

### Run Specific Test File
```bash
pnpm test __tests__/regression/reward-double-issuance.test.ts
```

### Run with Coverage
```bash
pnpm test __tests__/regression/ --coverage
```

### Run in Watch Mode
```bash
pnpm test __tests__/regression/ --watch
```

## Nightly Workflow

The regression test suite runs automatically every night at 2 AM UTC via GitHub Actions.

**Workflow File:** `.github/workflows/regression-tests-nightly.yml`

### Workflow Steps:
1. Checkout code
2. Install dependencies
3. Run regression tests against staging
4. Upload test results
5. Generate test report
6. Send alerts on failure (Slack + Email)
7. Create GitHub issue on failure
8. Publish results to dashboard

### Manual Trigger
You can manually trigger the workflow from the GitHub Actions tab:
1. Go to Actions → Regression Tests (Nightly)
2. Click "Run workflow"
3. Select branch and click "Run workflow"

## Failure Alerts

When regression tests fail, the following alerts are triggered:

### 1. Slack Notification
- Sent to engineering team channel
- Includes workflow link and environment info
- Immediate notification

### 2. Email Notification
- Sent to engineering team email list
- Contains failure details and action items
- Includes workflow run link

### 3. GitHub Issue
- Automatically created with "regression" label
- Tagged as high-priority
- Includes test results and next steps

## Test Results Dashboard

Test results are published to a dashboard accessible to the QA team:

**Dashboard URL:** https://dashboard.example.com/regression-tests

The dashboard shows:
- Test pass/fail status
- Coverage metrics
- Historical trends
- Failure patterns

## Adding New Regression Tests

When adding a new regression test:

1. Create a new test file in `__tests__/regression/`
2. Name it descriptively (e.g., `payment-timeout-handling.test.ts`)
3. Add the regression issue tag in the file header:
   ```typescript
   /**
    * Regression Test: [Test Name]
    * Closes #644
    * 
    * @regression-issue #XXX (replace with actual issue number)
    * 
    * Description of what this test prevents
    */
   ```
4. Write comprehensive test cases
5. Update this README with the new test
6. Ensure the test runs in the nightly workflow

## Test Tagging Convention

Each regression test must include:
- `@regression-issue` tag with the original bug issue number
- Clear description of what regression it prevents
- Link to the original issue in comments

Example:
```typescript
/**
 * Regression Test: Payment Timeout Handling
 * Closes #644
 * 
 * @regression-issue #789
 * 
 * This test ensures that payment timeouts are handled gracefully.
 * Previously, timeouts caused the system to hang indefinitely.
 */
```

## Best Practices

1. **Test Real Scenarios:** Tests should mirror actual production scenarios
2. **Use Realistic Data:** Mock data should be representative of production
3. **Test Edge Cases:** Cover boundary conditions and error paths
4. **Keep Tests Independent:** Each test should run in isolation
5. **Document Clearly:** Explain what regression is being prevented
6. **Update Regularly:** Keep tests current with codebase changes

## Troubleshooting

### Tests Failing Locally
1. Ensure you have the latest dependencies: `pnpm install`
2. Generate Prisma client: `pnpm prisma generate`
3. Check environment variables are set correctly
4. Clear Jest cache: `pnpm jest --clearCache`

### Tests Passing Locally but Failing in CI
1. Check staging environment configuration
2. Verify database state in staging
3. Review CI logs for environment-specific issues
4. Ensure secrets are configured in GitHub

### False Positives
If a test is failing due to environmental issues rather than actual bugs:
1. Investigate the root cause
2. Fix the test or environment
3. Document the issue
4. Consider adding retry logic for flaky tests

## Maintenance

### Weekly Tasks
- Review test results dashboard
- Investigate any flaky tests
- Update test data if needed

### Monthly Tasks
- Review test coverage
- Add tests for new critical flows
- Remove obsolete tests
- Update documentation

### Quarterly Tasks
- Audit all regression tests
- Refactor tests for maintainability
- Review alert thresholds
- Update dashboard metrics

## Contact

For questions or issues with regression tests:
- **Slack:** #engineering-qa
- **Email:** qa-team@example.com
- **GitHub:** Create an issue with the "testing" label

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
