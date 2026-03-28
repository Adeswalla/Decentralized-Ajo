# Transaction Flow Diagram

## Complete Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INITIATES ACTION                        │
│                    (e.g., clicks "Contribute")                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: BUILD TRANSACTION                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Frontend → Backend API                                     │    │
│  │  POST /api/circles/[id]/build-contribution-tx              │    │
│  │  Body: { amount: 100 }                                     │    │
│  │                                                             │    │
│  │  Backend builds Soroban transaction XDR                    │    │
│  │  Returns: { xdr: "AAAAAgAAAAC..." }                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Status: building                                                    │
│  UI: "Building transaction..." or loading spinner                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 2: SIGN TRANSACTION                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  submitTransaction(xdr) called                             │    │
│  │         ↓                                                   │    │
│  │  Freighter wallet popup appears                            │    │
│  │         ↓                                                   │    │
│  │  User reviews transaction details                          │    │
│  │         ↓                                                   │    │
│  │  User clicks "Approve" or "Reject"                         │    │
│  │         ↓                                                   │    │
│  │  Returns signed XDR or throws error                        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Status: signing                                                     │
│  Toast: 🔐 "Signing Transaction"                                    │
│  UI: "Waiting for signature..."                                     │
│                                                                       │
│  Possible outcomes:                                                  │
│  ✅ User approves → Continue to Step 3                              │
│  ❌ User rejects → Show "Transaction Canceled" → END               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   STEP 3: SUBMIT TRANSACTION                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  server.sendTransaction(signedTransaction)                 │    │
│  │         ↓                                                   │    │
│  │  Broadcast to Stellar network                              │    │
│  │         ↓                                                   │    │
│  │  Returns: { hash: "abc123...", status: "PENDING" }        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Status: submitting                                                  │
│  Toast: 📤 "Submitting Transaction"                                 │
│  UI: "Submitting..."                                                │
│                                                                       │
│  Possible outcomes:                                                  │
│  ✅ Submitted successfully → Continue to Step 4                     │
│  ❌ Network error → Show error → END                                │
│  ❌ Insufficient balance → Show error → END                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 4: POLL FOR CONFIRMATION                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Loop (every 2 seconds, max 60 seconds):                   │    │
│  │    server.getTransaction(hash)                             │    │
│  │         ↓                                                   │    │
│  │    Check status:                                           │    │
│  │      • NOT_FOUND → Continue polling                        │    │
│  │      • PENDING → Continue polling                          │    │
│  │      • SUCCESS → Go to Step 5                              │    │
│  │      • FAILED → Show error → END                           │    │
│  │         ↓                                                   │    │
│  │    If timeout reached → Show timeout error → END           │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Status: polling                                                     │
│  Toast: ⏳ "Confirming Transaction"                                 │
│  UI: "Confirming..."                                                │
│                                                                       │
│  Polling configuration:                                              │
│  • Interval: 2 seconds (configurable)                               │
│  • Timeout: 60 seconds (configurable)                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 5: SUCCESS HANDLING                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Transaction confirmed on-chain                            │    │
│  │         ↓                                                   │    │
│  │  onSuccess callback triggered                              │    │
│  │         ↓                                                   │    │
│  │  Update database with transaction hash                     │    │
│  │         ↓                                                   │    │
│  │  Refresh UI data (mutate/refetch)                          │    │
│  │         ↓                                                   │    │
│  │  Show success message                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Status: success                                                     │
│  Toast: ✅ "Transaction Confirmed"                                  │
│  UI: Reset to initial state or show success                         │
│                                                                       │
│  Transaction complete! ✨                                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ERROR SCENARIOS                              │
└─────────────────────────────────────────────────────────────────────┘

User Cancellation:
┌──────────────┐
│ User clicks  │
│   "Reject"   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Error: "User declined access"        │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ parseTransactionError()              │
│ → isUserCanceled: true               │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Toast: 🚫 "Transaction Canceled"     │
│ UI: Reset to initial state           │
│ No error logging                     │
└──────────────────────────────────────┘

Timeout:
┌──────────────┐
│ 60 seconds   │
│   elapsed    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Error: "Transaction polling timeout" │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Toast: ⏱️ "Transaction Timeout"      │
│ Note: May still succeed              │
│ UI: Reset to initial state           │
└──────────────────────────────────────┘

Insufficient Balance:
┌──────────────┐
│ Transaction  │
│   rejected   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Error: "insufficient balance"        │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Toast: 💰 "Insufficient Balance"     │
│ UI: Reset to initial state           │
│ Log error                            │
└──────────────────────────────────────┘

Network Error:
┌──────────────┐
│ Connection   │
│    lost      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Error: "network error"               │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Toast: ❌ "Network Error"            │
│ UI: Reset to initial state           │
│ Log error                            │
└──────────────────────────────────────┘
```

## State Transition Diagram

```
                    ┌──────┐
                    │ idle │ ◄─────────────────┐
                    └───┬──┘                   │
                        │                      │
                        │ submitTransaction()  │
                        │                      │
                        ▼                      │
                  ┌──────────┐                │
                  │ signing  │                │
                  └─────┬────┘                │
                        │                     │
                   User approves              │
                        │                     │
                        ▼                     │
                 ┌─────────────┐             │
                 │ submitting  │             │
                 └──────┬──────┘             │
                        │                    │
                  Broadcast OK               │
                        │                    │
                        ▼                    │
                  ┌──────────┐              │
                  │ polling  │              │
                  └─────┬────┘              │
                        │                   │
                  Confirmed                 │
                        │                   │
                        ▼                   │
                  ┌──────────┐             │
                  │ success  │─────────────┘
                  └──────────┘    reset()

                  Any error
                        │
                        ▼
                  ┌──────────┐
                  │  error   │─────────────┐
                  └──────────┘             │
                        │                  │
                        └──────────────────┘
                           reset()
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Component                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  const { submitTransaction, isSubmitting, status }         │    │
│  │    = useTransactionSubmit({ onSuccess, onError })          │    │
│  │                                                             │    │
│  │  <Button onClick={handleTransaction}                       │    │
│  │          disabled={isSubmitting}>                          │    │
│  │    {status === 'signing' && 'Waiting...'}                  │    │
│  │  </Button>                                                  │    │
│  └────────────────────────────┬───────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  │ uses
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   useTransactionSubmit Hook                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  • Manages state (status, hash, error)                     │    │
│  │  • Calls wallet context methods                            │    │
│  │  • Shows toast notifications                               │    │
│  │  • Handles polling logic                                   │    │
│  │  • Triggers callbacks                                      │    │
│  └────────────────────────────┬───────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  │ uses
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Wallet Context                                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  • signTransaction(xdr) → signedXdr                        │    │
│  │  • signAndSubmit(xdr) → { hash, status, response }        │    │
│  │  • Manages wallet connection                               │    │
│  │  • Interacts with Freighter                                │    │
│  └────────────────────────────┬───────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  │ uses
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Stellar SDK & Freighter                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  • Freighter: Sign transactions                            │    │
│  │  • SorobanRpc: Submit & poll transactions                  │    │
│  │  • Stellar SDK: Transaction building                       │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
User Action
    │
    ▼
┌─────────────────┐
│   Component     │
│  handleClick()  │
└────────┬────────┘
         │
         │ 1. Fetch XDR from backend
         │
         ▼
┌─────────────────┐
│   Backend API   │
│  Build TX XDR   │
└────────┬────────┘
         │
         │ 2. Return XDR
         │
         ▼
┌─────────────────┐
│   Component     │
│ submitTx(xdr)   │
└────────┬────────┘
         │
         │ 3. Call hook
         │
         ▼
┌─────────────────┐
│  Transaction    │
│     Hook        │
└────────┬────────┘
         │
         │ 4. Sign
         │
         ▼
┌─────────────────┐
│ Wallet Context  │
│ signTransaction │
└────────┬────────┘
         │
         │ 5. Request signature
         │
         ▼
┌─────────────────┐
│   Freighter     │
│  User approves  │
└────────┬────────┘
         │
         │ 6. Signed XDR
         │
         ▼
┌─────────────────┐
│ Wallet Context  │
│ Submit to RPC   │
└────────┬────────┘
         │
         │ 7. Broadcast
         │
         ▼
┌─────────────────┐
│  Stellar RPC    │
│  Process TX     │
└────────┬────────┘
         │
         │ 8. Poll status
         │
         ▼
┌─────────────────┐
│ Wallet Context  │
│  Poll & wait    │
└────────┬────────┘
         │
         │ 9. Confirmed
         │
         ▼
┌─────────────────┐
│  Transaction    │
│      Hook       │
│  onSuccess()    │
└────────┬────────┘
         │
         │ 10. Update DB
         │
         ▼
┌─────────────────┐
│   Backend API   │
│  Save TX hash   │
└────────┬────────┘
         │
         │ 11. Refresh UI
         │
         ▼
┌─────────────────┐
│   Component     │
│  Show success   │
└─────────────────┘
```

## Timeline Diagram

```
Time →

0s     User clicks button
       │
0.1s   Fetch XDR from backend
       │
0.5s   XDR received
       │
0.6s   submitTransaction() called
       │
0.7s   Toast: "🔐 Signing Transaction"
       │
0.8s   Freighter popup appears
       │
       [User reviews transaction]
       │
3.0s   User clicks "Approve"
       │
3.1s   Signed XDR returned
       │
3.2s   Toast: "📤 Submitting Transaction"
       │
3.3s   Broadcast to network
       │
3.8s   Transaction hash received
       │
3.9s   Toast: "⏳ Confirming Transaction"
       │
4.0s   Start polling (attempt 1)
       │
6.0s   Poll (attempt 2) - PENDING
       │
8.0s   Poll (attempt 3) - PENDING
       │
10.0s  Poll (attempt 4) - SUCCESS
       │
10.1s  Toast: "✅ Transaction Confirmed"
       │
10.2s  onSuccess() callback
       │
10.3s  Update database
       │
10.5s  Refresh UI
       │
10.6s  Complete! ✨

Total time: ~10 seconds
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Button     │  │    Toast     │  │   Status     │             │
│  │  Component   │  │ Notification │  │  Indicator   │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                         Business Logic Layer                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         useTransactionSubmit Hook                            │  │
│  │  • State management                                          │  │
│  │  • Toast notifications                                       │  │
│  │  • Error handling                                            │  │
│  │  • Polling logic                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                         Integration Layer                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Wallet Context                                       │  │
│  │  • Wallet connection                                         │  │
│  │  • Transaction signing                                       │  │
│  │  • Transaction submission                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                         External Services                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Freighter   │  │  Stellar     │  │   Backend    │             │
│  │   Wallet     │  │     RPC      │  │     API      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```
