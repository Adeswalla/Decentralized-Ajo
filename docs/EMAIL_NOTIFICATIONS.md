# Email Notification System

Stellar Ajo uses [Resend](https://resend.com) for transactional email.

---

## Configuration

**Package:** `resend`

**File:** `lib/email.ts`

```ts
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Ajo Platform <alerts@yourdomain.com>';
```

**Required environment variable:**

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

> The `FROM` address (`alerts@yourdomain.com`) must be updated to a domain you own and have verified in the Resend dashboard before deploying to production.

---

## Email Functions

### `sendPayoutAlert(email, userName, amount)`

**Trigger:** Called automatically inside `POST /api/circles/:id/contribute` when all members in the current round have contributed.

**Logic in `app/api/circles/[id]/contribute/route.ts`:**

```ts
totalContributedThisRound = contributedIds.size + 1  // +1 for current contribution

if (totalContributedThisRound >= allMembers.length) {
  // find the member whose rotationOrder === circle.currentRound
  // call sendPayoutAlert(member.email, member.firstName, payoutAmount)
}
```

**Payout amount calculation:** `circle.contributionAmount * allMembers.length`

**Subject:** `"It's your turn — payout ready!"`

**Body:**
```
Hi {userName},

Your payout of {amount} XLM is ready to claim.
Log in to your Ajo dashboard to claim it.
```

---

### `sendContributionReminder(email, userName, amount, circleName)`

**Trigger:** Called automatically inside `POST /api/circles/:id/contribute` for every member who has NOT yet contributed in the current round, immediately after a contribution is recorded.

**Logic:**

```ts
contributedIds = // set of userIds who have contributed this round

for (const member of allMembers) {
  if (!contributedIds.has(member.userId)) {
    sendContributionReminder(member.email, member.firstName, circle.contributionAmount, circle.name);
  }
}
```

**Subject:** `"Contribution due for {circleName}"`

**Body:**
```
Hi {userName},

Your contribution of {amount} XLM is due for the circle {circleName}.
Please contribute before the deadline.
```

---

## Error Handling

Both functions wrap the Resend API call in a `try/catch`. If the email fails to send, the error is logged to the console with a `[email]` prefix but does **not** throw — the API response to the client is unaffected by email failures.

```ts
} catch (err) {
  console.error('[email] sendPayoutAlert failed:', err);
}
```

Email delivery is best-effort. For production, consider adding a retry queue or monitoring Resend webhook events for delivery failures.

---

## Setting Up Resend

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Create an API key
4. Add to `.env.local`:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   ```
5. Update the `FROM` constant in `lib/email.ts` to use your verified domain

---

## Testing Emails Locally

**Option A — Resend test mode:**
Resend allows sending to your own verified email address during development. Set `RESEND_API_KEY` to your real key and use your own email as the recipient.

**Option B — Mock the module:**
For automated testing, mock `lib/email.ts` so no real emails are sent:

```ts
jest.mock('@/lib/email', () => ({
  sendPayoutAlert: jest.fn(),
  sendContributionReminder: jest.fn(),
}));
```

**Option C — Disable in development:**
Add a guard at the top of each function:

```ts
if (process.env.NODE_ENV !== 'production') {
  console.log('[email] Skipping in development:', { email, userName });
  return;
}
```

---

## Future Email Notifications to Consider

The following events currently have no email notification and could be added:

| Event | Suggested Function |
|---|---|
| New member joins a circle | `sendMemberJoinedNotification` |
| New governance proposal created | `sendNewProposalNotification` |
| Governance vote result | `sendVoteResultNotification` |
| Partial withdrawal approved | `sendWithdrawalApprovedNotification` |
| Circle completed (all rounds done) | `sendCircleCompletedNotification` |
| Emergency panic triggered | `sendEmergencyAlertNotification` |
