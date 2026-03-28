# Manual Testing Guide for Transaction Flow

This guide helps you manually test the transaction flow implementation.

## Prerequisites

1. Freighter wallet extension installed
2. Testnet account with XLM balance
3. Application running on localhost
4. Backend API endpoints configured

## Test Cases

### Test 1: Successful Transaction Flow

**Steps:**
1. Connect wallet using the wallet button
2. Navigate to a circle detail page
3. Click "Contribute" button
4. Observe toast notification: "🔐 Signing Transaction"
5. Approve transaction in Freighter popup
6. Observe toast notification: "📤 Submitting Transaction"
7. Observe toast notification: "⏳ Confirming Transaction"
8. Wait for confirmation (2-10 seconds typically)
9. Observe toast notification: "✅ Transaction Confirmed"

**Expected Results:**
- All toast notifications appear in sequence
- Button shows correct status text during each stage
- Button is disabled during transaction
- Transaction hash is logged to console
- Database is updated after confirmation
- UI refreshes with new data

**Pass/Fail:** ___________

---

### Test 2: User Cancels Transaction

**Steps:**
1. Connect wallet
2. Initiate a transaction
3. When Freighter popup appears, click "Reject" or close the popup
4. Observe the error handling

**Expected Results:**
- Toast shows: "🚫 Transaction Canceled"
- Description: "You canceled the transaction in your wallet."
- Button returns to enabled state
- No database changes occur
- UI remains in original state

**Pass/Fail:** ___________

---

### Test 3: Transaction Timeout

**Steps:**
1. Modify polling timeout to 5 seconds (for testing):
   ```typescript
   const { submitTransaction } = useTransactionSubmit({
     pollingTimeout: 5000, // 5 seconds
   });
   ```
2. Initiate a transaction
3. Approve in wallet
4. Wait for timeout

**Expected Results:**
- Toast shows: "⏱️ Transaction Timeout"
- Description mentions transaction may still succeed
- Button returns to enabled state
- Error is logged to console

**Pass/Fail:** ___________

---

### Test 4: Insufficient Balance

**Steps:**
1. Use a wallet with insufficient XLM balance
2. Attempt a transaction
3. Observe error handling

**Expected Results:**
- Toast shows: "💰 Insufficient Balance"
- Clear error message about funds
- Button returns to enabled state
- No partial state changes

**Pass/Fail:** ___________

---

### Test 5: Wallet Not Connected

**Steps:**
1. Ensure wallet is disconnected
2. Click transaction button
3. Observe behavior

**Expected Results:**
- Button is disabled OR
- Alert/toast prompts to connect wallet
- No transaction attempt is made

**Pass/Fail:** ___________

---

### Test 6: Network Error During Submission

**Steps:**
1. Disconnect internet after signing
2. Observe error handling
3. Reconnect and verify state

**Expected Results:**
- Appropriate error message shown
- Button returns to enabled state
- Can retry transaction
- No corrupted state

**Pass/Fail:** ___________

---

### Test 7: Multiple Rapid Clicks

**Steps:**
1. Click transaction button multiple times rapidly
2. Observe behavior

**Expected Results:**
- Only one transaction is initiated
- Button is disabled after first click
- No duplicate transactions
- No UI glitches

**Pass/Fail:** ___________

---

### Test 8: Transaction Status Indicators

**Steps:**
1. Initiate a transaction
2. Observe button text changes
3. Verify each status is displayed

**Expected Results:**
- Button shows: "Waiting for signature..."
- Then: "Submitting..."
- Then: "Confirming..."
- Finally: Returns to "Contribute" or shows success state
- Loading spinner appears during process

**Pass/Fail:** ___________

---

### Test 9: Database Synchronization

**Steps:**
1. Complete a successful transaction
2. Check database for new record
3. Verify transaction hash is stored
4. Confirm all related data is updated

**Expected Results:**
- New contribution record created
- Transaction hash matches on-chain hash
- Circle totals are updated
- User balance reflects change

**Pass/Fail:** ___________

---

### Test 10: Console Logging

**Steps:**
1. Open browser console
2. Initiate a transaction
3. Observe console output

**Expected Results:**
- Transaction hash logged on success
- Clear error messages on failure
- No sensitive data exposed
- Helpful debugging information available

**Pass/Fail:** ___________

---

## Browser Testing

Test in multiple browsers:
- [ ] Chrome
- [ ] Firefox
- [ ] Edge
- [ ] Brave

## Device Testing

Test on different devices:
- [ ] Desktop
- [ ] Tablet
- [ ] Mobile (if supported)

## Network Testing

Test on different networks:
- [ ] Testnet (primary)
- [ ] Mainnet (after testnet success)

## Performance Checks

- [ ] Transaction completes in reasonable time (<30s typical)
- [ ] UI remains responsive during transaction
- [ ] No memory leaks after multiple transactions
- [ ] Toast notifications don't stack excessively

## Accessibility Checks

- [ ] Screen reader announces status changes
- [ ] Keyboard navigation works
- [ ] Focus management is correct
- [ ] Color contrast is sufficient for status indicators

## Notes

Use this section to document any issues found:

```
Issue 1:
Description: 
Steps to reproduce:
Expected:
Actual:

Issue 2:
Description:
Steps to reproduce:
Expected:
Actual:
```

## Sign-off

Tester: ___________________
Date: _____________________
Version: __________________
Overall Status: PASS / FAIL / NEEDS WORK
