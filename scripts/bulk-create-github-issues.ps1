#Requires -Version 5.1
<#
.SYNOPSIS
  Creates 40 structured GitHub issues for Decentralized-Ajo (Frontend, Backend, Smart Contracts).

.PARAMETER Repo
  owner/name (default: Adeswalla/Decentralized-Ajo)

.PARAMETER DryRun
  Validate definitions and print titles only; do not call the GitHub API.

  Usage:
    .\scripts\bulk-create-github-issues.ps1
    .\scripts\bulk-create-github-issues.ps1 -DryRun

  Auth (one of):
    gh auth login
    $env:GH_TOKEN = '<pat-with-repo-scope>'
#>
[CmdletBinding()]
param(
    [string]$Repo = "Adeswalla/Decentralized-Ajo",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function New-StructuredIssueBody {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('Frontend','Backend','Smart Contracts')]
        [string]$Track,
        [Parameter(Mandatory)][string]$Stack,
        [Parameter(Mandatory)][string]$Summary,
        [Parameter(Mandatory)][string]$Problem,
        [Parameter(Mandatory)][string[]]$Approach,
        [Parameter(Mandatory)][string[]]$Acceptance,
        [string[]]$References = @(),
        [string]$Risks,
        [string]$OutOfScope
    )
    $nl = [Environment]::NewLine
    $b = New-Object System.Text.StringBuilder

    [void]$b.AppendLine("### Track")
    [void]$b.AppendLine("**$Track** · $Stack")
    [void]$b.AppendLine("")
    [void]$b.AppendLine("### Summary")
    [void]$b.AppendLine($Summary.Trim())
    [void]$b.AppendLine("")
    [void]$b.AppendLine("### Problem / goal")
    [void]$b.AppendLine($Problem.Trim())
    [void]$b.AppendLine("")
    [void]$b.AppendLine("### Proposed approach")
    foreach ($line in $Approach) {
        [void]$b.AppendLine("- $($line.Trim())")
    }
    [void]$b.AppendLine("")
    [void]$b.AppendLine("### Acceptance criteria")
    foreach ($line in $Acceptance) {
        [void]$b.AppendLine("- [ ] $($line.Trim())")
    }
    [void]$b.AppendLine("")
    if ($References -and $References.Count -gt 0) {
        [void]$b.AppendLine("### References (codebase)")
        foreach ($r in $References) {
            [void]$b.AppendLine("- ``$($r.Trim())``")
        }
        [void]$b.AppendLine("")
    }
    if (-not [string]::IsNullOrWhiteSpace($Risks)) {
        [void]$b.AppendLine("### Risks / open questions")
        [void]$b.AppendLine($Risks.Trim())
        [void]$b.AppendLine("")
    }
    if (-not [string]::IsNullOrWhiteSpace($OutOfScope)) {
        [void]$b.AppendLine("### Out of scope")
        [void]$b.AppendLine($OutOfScope.Trim())
        [void]$b.AppendLine("")
    }

    $b.ToString().TrimEnd()
}

function New-Issue {
    param(
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][ValidateSet('Frontend','Backend','Smart Contracts')][string]$Track,
        [Parameter(Mandatory)][string]$Stack,
        [Parameter(Mandatory)][string]$Summary,
        [Parameter(Mandatory)][string]$Problem,
        [Parameter(Mandatory)][string[]]$Approach,
        [Parameter(Mandatory)][string[]]$Acceptance,
        [string[]]$References = @(),
        [string]$Risks = $null,
        [string]$OutOfScope = $null
    )
    $bodySplat = @{
        Track        = $Track
        Stack        = $Stack
        Summary      = $Summary
        Problem      = $Problem
        Approach     = $Approach
        Acceptance   = $Acceptance
        References   = $References
    }
    if (-not [string]::IsNullOrWhiteSpace($Risks)) { $bodySplat.Risks = $Risks }
    if (-not [string]::IsNullOrWhiteSpace($OutOfScope)) { $bodySplat.OutOfScope = $OutOfScope }
    @{ title = $Title; body = (New-StructuredIssueBody @bodySplat) }
}

$ghCandidates = @(
    "${env:ProgramFiles}\GitHub CLI\gh.exe",
    "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe"
)
$gh = $ghCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $gh) { $gh = "gh" }

if (-not $DryRun) {
    $authOk = $true
    try {
        [void](& $gh auth status 2>&1)
        if ($LASTEXITCODE -ne 0) { $authOk = $false }
    } catch {
        $authOk = $false
    }
    if (-not $authOk) {
        Write-Error @"
GitHub CLI is not authenticated.

  gh auth login
  # or:
  `${env:GH_TOKEN} = '<token-with-repo-scope>'

Then re-run this script (omit -DryRun).
"@
    }
}

$stackFe = "Next.js 16 (App Router), React, shadcn/ui, Tailwind CSS 4, SWR"
$stackBe = "Next.js route handlers, Prisma, JWT/bcrypt, SQLite/Postgres"
$stackSc = "Soroban (Rust), Stellar SDK, contracts/ajo-circle"

$issues = @(
    # --- Frontend (14) ---
    (New-Issue -Title "[Frontend] Route-level and Suspense loading for circle detail" `
        -Track Frontend -Stack $stackFe `
        -Summary "Users should see consistent loading feedback when opening a circle or its governance views." `
        -Problem "Navigating to /circles/[id] and nested routes can briefly show empty UI; this hurts perceived performance and accessibility (no busy state)." `
        -Approach @(
            "Identify data boundaries (server components vs client) on circle detail and governance pages.",
            "Add React.Suspense fallbacks or skeleton components aligned with existing shadcn patterns.",
            "Ensure loading UI does not cause large CLS when data resolves."
        ) `
        -Acceptance @(
            "Loading state is visible within one paint after navigation.",
            "Skeletons or spinners match typography/spacing of loaded content where practical.",
            "No uncaught suspense errors in production build."
        ) `
        -References @(
            "app/circles/[id]/page.tsx",
            "app/circles/[id]/governance/page.tsx",
            "components/ui/skeleton.tsx"
        )),
    (New-Issue -Title "[Frontend] Optimistic UI for governance votes" `
        -Track Frontend -Stack $stackFe `
        -Summary "Reflect vote actions immediately in the UI, with safe rollback on failure." `
        -Problem "Vote submissions may feel sluggish; users may double-submit or assume failure when the API is slow." `
        -Approach @(
            "On successful local validation, optimistically update tallies or voted state in the client store/SWR cache.",
            "On 4xx/5xx or network error, revert optimistic state and surface a toast with the server message.",
            "Disable the vote control while the request is in flight after rollback is applied."
        ) `
        -Acceptance @(
            "Optimistic state appears immediately on click.",
            "Failed requests restore prior tallies and never leave stale success state.",
            "E2E or manual test documented for vote error path."
        ) `
        -References @(
            "app/api/circles/[id]/governance/[proposalId]/vote/route.ts",
            "components/governance/proposal-card.tsx",
            "components/governance/create-proposal-dialog.tsx"
        )),
    (New-Issue -Title "[Frontend] Playwright E2E: register, login, create circle" `
        -Track Frontend -Stack $stackFe `
        -Summary "Automate core user journeys to prevent regressions in auth and circle creation." `
        -Problem "Critical flows are only tested manually; breaking API or UI changes can ship unnoticed." `
        -Approach @(
            "Add Playwright with a base URL pointing at pnpm dev or CI preview.",
            "Cover register, login, and create-circle happy paths with stable selectors (roles/labels).",
            "Document how to run tests locally; optional follow-up for GitHub Actions."
        ) `
        -Acceptance @(
            "pnpm exec playwright test passes locally against documented env.",
            "Tests avoid flakiness (explicit waits for navigation/network).",
            "README or CONTRIBUTING mentions E2E prerequisites."
        ) `
        -References @(
            "app/auth/register/page.tsx",
            "app/auth/login/page.tsx",
            "app/circles/create/page.tsx"
        )),
    (New-Issue -Title "[Frontend] Mobile layout polish for governance and transactions" `
        -Track Frontend -Stack $stackFe `
        -Summary "Governance and transaction views should be fully usable on small screens." `
        -Problem "Tables, proposal cards, or filters may overflow or have cramped tap targets on mobile." `
        -Approach @(
            "Audit transactions and governance pages at common breakpoints (360-430px width).",
            "Prefer stacked layouts, horizontal scroll only where intentional, min 44px tap targets.",
            "Verify sidebar/header do not trap focus on mobile dialogs."
        ) `
        -Acceptance @(
            "No horizontal scroll on primary content except intentional tables with scroll hint.",
            "Interactive controls meet minimum touch target guidelines.",
            "Screenshots or short Loom in PR for before/after (optional but encouraged)."
        ) `
        -References @(
            "app/transactions/page.tsx",
            "app/circles/[id]/governance/page.tsx",
            "components/layout/header.tsx"
        )),
    (New-Issue -Title "[Frontend] Stellar network indicator and safe signing context" `
        -Track Frontend -Stack $stackFe `
        -Summary "Users must always know whether they are on testnet or mainnet before signing." `
        -Problem "Signing on the wrong network causes confusion and failed transactions." `
        -Approach @(
            "Surfaced selected network near wallet connect (header or wallet drawer).",
            "Wire into lib/stellar-config / wallet context; block or warn on mismatch with app config when product requires it.",
            "Copy should explain how to switch network in Freighter/Lobstr when applicable."
        ) `
        -Acceptance @(
            "Active network is visible on all pages that trigger chain actions.",
            "Mismatch between app env and wallet is handled with a clear modal or toast.",
            "Document behavior in README under wallet section."
        ) `
        -References @(
            "lib/stellar-config.ts",
            "lib/wallet-context.tsx",
            "components/wallet-button.tsx"
        )),
    (New-Issue -Title "[Frontend] Explorer / Laboratory deep links for on-chain activity" `
        -Track Frontend -Stack $stackFe `
        -Summary "Make transaction hashes and contract IDs discoverable in external tools." `
        -Problem "Power users cannot jump from in-app activity to Stellar explorers or Lab for debugging." `
        -Approach @(
            "Define URL builders per network (testnet vs future mainnet) for txs and contracts.",
            "Expose links wherever the app surfaces hashes (transactions list, post-submit success).",
            "Open in new tab with rel=noopener noreferrer."
        ) `
        -Acceptance @(
            "Every displayed hash has a working explorer link for the current network.",
            "Broken network config fails gracefully (hide link + message).",
            "No PII in query strings."
        ) `
        -References @(
            "app/transactions/page.tsx",
            "lib/stellar-config.ts"
        )),
    (New-Issue -Title "[Frontend] Accessibility pass: forms, dialogs, wallet flows" `
        -Track Frontend -Stack $stackFe `
        -Summary "Meet baseline WCAG 2.1 AA for auth, circle forms, and governance dialogs." `
        -Problem "Keyboard and screen-reader users may miss labels, focus traps, or error announcements." `
        -Approach @(
            "Run axe or Lighthouse on auth, create circle, profile, governance dialog routes.",
            "Ensure visible focus rings, correct aria-invalid / describedby on fields.",
            "Verify modal focus return on close (Radix/shadcn defaults)."
        ) `
        -Acceptance @(
            "No critical axe violations on targeted routes.",
            "All interactive elements reachable via Tab; Escape closes dialogs.",
            "Document any known exceptions in issue/PR."
        ) `
        -References @(
            "app/auth/login/page.tsx",
            "app/circles/create/page.tsx",
            "components/ui/dialog.tsx",
            "components/governance/create-proposal-dialog.tsx"
        )),
    (New-Issue -Title "[Frontend] Rich empty states (dashboard, transactions, circles)" `
        -Track Frontend -Stack $stackFe `
        -Summary "Guide new users when lists are empty instead of showing blank panels." `
        -Problem "Empty data looks like errors and hides next steps (join/create/connect wallet)." `
        -Approach @(
            "Use or extend components/ui/empty patterns with illustrations/copy per surface.",
            "Primary CTA per context: Connect wallet / Create circle / Join circle.",
            "Respect dark/light theme."
        ) `
        -Acceptance @(
            "Each major list view has a designed empty state with CTA.",
            "Copy reviewed for tone and clarity.",
            "Analytics hooks optional follow-up."
        ) `
        -References @(
            "components/dashboard/circle-list.tsx",
            "app/transactions/page.tsx",
            "components/ui/empty.tsx"
        )),
    (New-Issue -Title "[Frontend] Debounced search and filter for circle list" `
        -Track Frontend -Stack $stackFe `
        -Summary "Support finding circles efficiently as membership grows." `
        -Problem "Large lists without filtering degrade UX and may cause unnecessary re-renders." `
        -Approach @(
            "Add client-side filter debounce (e.g. 200-300ms) or server query params + SWR key.",
            "Define sort order (name, date, status) with stable UX controls.",
            "Virtualize only if profiling shows need; start simple."
        ) `
        -Acceptance @(
            "Typing in search does not thrash the API or main thread.",
            "Filter state is reflected in URL query when server-backed (recommended for shareable links).",
            "Document limits (max client list size) if applicable."
        ) `
        -References @(
            "components/dashboard/circle-list.tsx",
            "app/api/circles/route.ts"
        )),
    (New-Issue -Title "[Frontend] Standardize currency and amount display (Intl)" `
        -Track Frontend -Stack $stackFe `
        -Summary "Contributions and balances should render consistently across locales." `
        -Problem "Raw numbers or inconsistent decimals confuse users, especially for USDC/XLM." `
        -Approach @(
            "Centralize formatting helper using Intl.NumberFormat and explicit asset decimals.",
            "Use components/ui/amount-input.tsx consistently for entry; align display with validation.",
            "Document assumed decimals per testnet asset in code comment or small util docstring."
        ) `
        -Acceptance @(
            "All user-visible amounts use the shared formatter.",
            "Locales display grouping separators correctly; tests or snapshots for one non-en locale optional.",
            "Mismatch between input max decimals and chain is caught in validation when applicable."
        ) `
        -References @(
            "components/ui/amount-input.tsx",
            "lib/utils.ts"
        )),
    (New-Issue -Title "[Frontend] Guard against double-submit on contribute and join" `
        -Track Frontend -Stack $stackFe `
        -Summary "Prevent duplicate contributions or join attempts from rapid clicks or flaky networks." `
        -Problem "Double submissions can create duplicate API calls, confusing toasts, or wallet prompts." `
        -Approach @(
            "Disable primary button and show spinner when mutation is pending.",
            "Consider idempotency token from backend when available (coordinate with Backend issue).",
            "Handle wallet rejection without leaving the UI stuck disabled."
        ) `
        -Acceptance @(
            "Rapid clicks result in a single submit until completion.",
            "Wallet rejection re-enables the control with clear messaging.",
            "Manual test steps attached in PR."
        ) `
        -References @(
            "app/api/circles/[id]/contribute/route.ts",
            "app/api/circles/[id]/join/route.ts",
            "app/circles/[id]/page.tsx"
        )),
    (New-Issue -Title "[Frontend] Actionable wallet error messages" `
        -Track Frontend -Stack $stackFe `
        -Summary "Map technical wallet errors to clear recovery steps." `
        -Problem "Users see generic failures when Freighter is missing, locked, or user rejects a signature." `
        -Approach @(
            "Inventory error codes/strings from wallet SDK / Freighter integration.",
            "Centralize mapping in wallet-button or wallet-context with toast + doc links.",
            "Include install CTA when extension not detected."
        ) `
        -Acceptance @(
            "Top 5 error cases have dedicated copy and optional docs link.",
            "No stack traces or raw JSON shown in toasts for typical errors.",
            "Strings are reusable i18n-ready if you add locales later."
        ) `
        -References @(
            "components/wallet-button.tsx",
            "lib/wallet-context.tsx"
        )),
    (New-Issue -Title "[Frontend] Theme consistency audit (charts, cards, header)" `
        -Track Frontend -Stack $stackFe `
        -Summary "Dashboard visuals must match light/dark tokens across the app." `
        -Problem "Charts or legacy hard-coded colors may not respect theme-provider / CSS variables." `
        -Approach @(
            "Audit components/ui/chart.tsx consumers and dashboard cards.",
            "Replace hard-coded hex with theme CSS variables or Tailwind semantic tokens.",
            "Verify contrast in both modes."
        ) `
        -Acceptance @(
            "No major contrast failures in either theme on dashboard routes.",
            "Screenshots for light/dark in PR.",
            "Optional: add visual regression tooling later."
        ) `
        -References @(
            "components/ui/chart.tsx",
            "components/theme-provider.tsx",
            "app/page.tsx"
        )),
    (New-Issue -Title "[Frontend] Component documentation (Storybook or Ladle) for critical UI" `
        -Track Frontend -Stack $stackFe `
        -Summary "Isolate complex inputs and governance UI for faster design and code review." `
        -Problem "States like loading, error, and edge-case amounts are hard to review inside full pages." `
        -Approach @(
            "Add Storybook or Ladle with minimal config for AmountInput, proposal card states, error boundary fallback.",
            "Stories cover loading, empty, error, and success.",
            "Document how to run storybook in README."
        ) `
        -Acceptance @(
            "Story/ladle command runs locally.",
            "At least three high-value components documented.",
            "CI optional; not blocking merge."
        ) `
        -References @(
            "components/ui/amount-input.tsx",
            "components/governance/proposal-card.tsx",
            "components/error-fallback.tsx"
        ) `
        -OutOfScope "Full design system catalog; i18n."), 

    # --- Backend (14) ---
    (New-Issue -Title "[Backend] OpenAPI 3.x specification for HTTP API" `
        -Track Backend -Stack $stackBe `
        -Summary "Publish a machine-readable contract for all public REST routes." `
        -Problem "Mobile clients, QA tools, and new contributors lack a single source of truth for request/response shapes." `
        -Approach @(
            "Inventory routes under app/api/** (auth, circles, governance, transactions, users, health).",
            "Either generate from Zod/validation schemas or hand-maintain openapi.yaml.",
            "Version the spec file and link from README."
        ) `
        -Acceptance @(
            "Spec covers all documented endpoints with schemas and error shapes.",
            "Example requests validate with a linter (spectral or redocly CLI).",
            "CI step optional: fail on breaking changes to public operations."
        ) `
        -References @(
            "app/api",
            "lib/validations",
            "lib/api-helpers.ts"
        )),
    (New-Issue -Title "[Backend] Idempotency-Key for contribute and join mutations" `
        -Track Backend -Stack $stackBe `
        -Summary "Allow clients to safely retry writes without duplicate side effects." `
        -Problem "Network retries can double-apply joins or contributions off-chain (and confuse reconciliation)." `
        -Approach @(
            "Accept Idempotency-Key header (UUID) on POST contribute and join.",
            "Persist key + response hash or status in DB or short TTL cache; return cached response on replay within window.",
            "Define TTL (e.g. 24h) and document in OpenAPI."
        ) `
        -Acceptance @(
            "Duplicate keys return identical status/body as first success within TTL.",
            "Conflicting payload with same key returns 409.",
            "Integration test covers retry sequence."
        ) `
        -References @(
            "app/api/circles/[id]/contribute/route.ts",
            "app/api/circles/[id]/join/route.ts",
            "prisma/schema.prisma"
        )),
    (New-Issue -Title "[Backend] Audit trail for sensitive mutations" `
        -Track Backend -Stack $stackBe `
        -Summary "Record who did what, when, for compliance and incident response." `
        -Problem "Join, contribute, governance actions are not centrally auditable beyond raw logs." `
        -Approach @(
            "Choose structured logging (JSON) with user id, circle id, action, correlation id OR add AuditLog Prisma model.",
            "Emit entries from route handlers after successful commits.",
            "Ensure PII minimization (no passwords, no full JWT)."
        ) `
        -Acceptance @(
            "Defined list of audited actions is covered.",
            "Logs are queryable in prod sink (document fields).",
            "Retention policy documented."
        ) `
        -References @(
            "lib/logger.ts",
            "app/api/circles",
            "middleware.ts"
        )),
    (New-Issue -Title "[Backend] Production-grade rate limiting (shared store)" `
        -Track Backend -Stack $stackBe `
        -Summary "Scale rate limits beyond in-memory defaults in serverless/multi-instance deployments." `
        -Problem "lib/rate-limit may not coordinate across instances; auth endpoints remain abuse-prone." `
        -Approach @(
            "Introduce Redis (or Vercel KV / Upstash) behind a narrow interface in lib/rate-limit.",
            "Keep in-memory fallback for local dev; feature-flag store URL in prod.",
            "Tune limits per route class (auth vs read-only)."
        ) `
        -Acceptance @(
            "Integration test or staging verification shows consistent limiting with two instances.",
            "Document env vars and cost expectations.",
            "Fails open or closed per product decision - document which."
        ) `
        -References @(
            "lib/rate-limit.ts",
            "app/api/auth/login/route.ts"
        )),
    (New-Issue -Title "[Backend] Integration tests: circles + governance APIs" `
        -Track Backend -Stack $stackBe `
        -Summary "Exercise real handlers against a disposable database in CI." `
        -Problem "API regressions are only caught manually; migrations can drift from code." `
        -Approach @(
            "Use Vitest/Jest with Next request harness or supertest-style wrapper for route handlers.",
            "prisma migrate reset against test DB in pipeline; seed minimal users/circles.",
            "Cover happy path + primary 4xx paths for circles CRUD, vote, contribute."
        ) `
        -Acceptance @(
            "Tests run in CI on PR with Postgres or SQLite job matrix.",
            "No live network calls in unit/integration suite.",
            "Coverage report optional."
        ) `
        -References @(
            "app/api/circles",
            "package.json",
            "prisma"
        )),
    (New-Issue -Title "[Backend] Chain vs DB reconciliation job" `
        -Track Backend -Stack $stackBe `
        -Summary "Detect when Prisma state diverges from Soroban contract state." `
        -Problem "Indexer or manual DB edits can desync from on-chain truth, breaking user trust." `
        -Approach @(
            "Define canonical fields to compare (members, round, balances if mirrored).",
            "Scheduled worker (cron) queries Soroban RPC + compares to DB; flags discrepancies.",
            "Alerting hook (email/Slack) optional."
        ) `
        -Acceptance @(
            "Reconciliation report lists circle id + field deltas.",
            "Job is idempotent and safe to run hourly.",
            "Document operational runbook for fixing drift."
        ) `
        -References @(
            "lib/stellar-config.ts",
            "contracts/ajo-circle/src/lib.rs"
        ) `
        -Risks "Requires stable contract view methods and RPC quota planning."),
    (New-Issue -Title "[Backend] JWT refresh rotation and reuse detection" `
        -Track Backend -Stack $stackBe `
        -Summary "Reduce risk of stolen refresh tokens and session fixation." `
        -Problem "Long-lived sessions without rotation invite replay attacks if a refresh leaks." `
        -Approach @(
            "Review app/api/auth/refresh/route.ts and token storage in DB if any.",
            "Implement refresh token rotation (new refresh on each use) and invalidate family on reuse.",
            "Shorten access token TTL; document cookie vs header strategy."
        ) `
        -Acceptance @(
            "Reuse of old refresh token revokes session family.",
            "Automated test proves rotation sequence.",
            "Security notes added to README."
        ) `
        -References @(
            "app/api/auth/refresh/route.ts",
            "app/api/auth/logout/route.ts",
            "lib/auth.ts"
        )),
    (New-Issue -Title "[Backend] Mirror Soroban limits in API validation" `
        -Track Backend -Stack $stackBe `
        -Summary "Off-chain validation should match AjoCircle constraints to avoid surprise chain reverts." `
        -Problem "Users can pass API validation but still fail on-chain (max members, caps), harming UX." `
        -Approach @(
            "Extract constants from contract (documented table) into shared constants module or comments tied to wasm version.",
            "Update lib/validations Zod schemas for circles/members to enforce same bounds.",
            "Return 400 with same error codes/messages as contract where practical."
        ) `
        -Acceptance @(
            "MAX_MEMBERS/HARD_CAP (and related) aligned with contracts/ajo-circle.",
            "Unit tests for boundary values.",
            "Changelog note when contract bumps."
        ) `
        -References @(
            "lib/validations/circle.ts",
            "contracts/ajo-circle/src/lib.rs"
        )),
    (New-Issue -Title "[Backend] Pagination and filtering for GET /api/transactions" `
        -Track Backend -Stack $stackBe `
        -Summary "Support large transaction histories without loading everything at once." `
        -Problem "Flat list responses will not scale; frontend cannot filter by circle or date." `
        -Approach @(
            "Add cursor or offset pagination with stable sort (created desc).",
            "Query params: circleId, from, to, type.",
            "Update frontend SWR consumers to pass cursors."
        ) `
        -Acceptance @(
            "Default page size capped (e.g. 50) with nextCursor in response.",
            "Indexes added in Prisma if queries regress.",
            "OpenAPI updated."
        ) `
        -References @(
            "app/api/transactions/route.ts",
            "app/transactions/page.tsx"
        )),
    (New-Issue -Title "[Backend] Deep health check: database and Soroban RPC" `
        -Track Backend -Stack $stackBe `
        -Summary "Expose optional dependency checks for probes and status pages." `
        -Problem "/api/health may report OK while DB or chain RPC is degraded." `
        -Approach @(
            "Extend app/api/health/route.ts with ?deep=1 or separate admin-only route.",
            "Ping Prisma with SELECT 1; RPC with lightweight Soroban call or metadata fetch.",
            "Keep fast shallow path for load balancers."
        ) `
        -Acceptance @(
            "Deep mode returns structured JSON per dependency with latency ms.",
            "Does not leak secrets; rate-limit if public.",
            "Documented for deploy platforms (Vercel)."
        ) `
        -References @(
            "app/api/health/route.ts",
            "lib/prisma.ts",
            "lib/stellar-config.ts"
        )),
    (New-Issue -Title "[Backend] Email verification for new accounts" `
        -Track Backend -Stack $stackBe `
        -Summary "Verify email ownership before treating addresses as trusted identifiers." `
        -Problem "Registered emails are unverified; password reset and notifications may be abused." `
        -Approach @(
            "Use lib/email to send time-limited signed links post-register.",
            "Add fields: emailVerifiedAt; middleware or route guards for sensitive actions if product requires.",
            "Handle resend with rate limit."
        ) `
        -Acceptance @(
            "Cannot verify expired tokens; one-time use tokens.",
            "Tests for happy path + expired token.",
            "Product decision documented: what is gated pre-verify."
        ) `
        -References @(
            "lib/email.ts",
            "app/api/auth/register/route.ts",
            "prisma/schema.prisma"
        )),
    (New-Issue -Title "[Backend] Scheduler for contribution deadlines and reminders" `
        -Track Backend -Stack $stackBe `
        -Summary "Notify members before they miss a round deadline." `
        -Problem "Silent misses reduce circle health; users forget schedule." `
        -Approach @(
            "Define schedule source (DB fields aligned with contract rounds as applicable).",
            "Cron (Vercel cron / external worker) scans upcoming deadlines and queues emails/toasts via existing channels.",
            "Idempotent notifications (dedupe per round + user)."
        ) `
        -Acceptance @(
            "Configurable lead time (e.g. T-24h, T-1h).",
            "Logs show skipped vs sent counts.",
            "Graceful disable via env flag."
        ) `
        -References @(
            "lib/email.ts",
            "app/api/circles"
        ) `
        -Risks "May require wallet/email preference model."),
    (New-Issue -Title "[Backend] CI: Postgres migrate + smoke on pull requests" `
        -Track Backend -Stack $stackBe `
        -Summary "Catch migration and SQL compatibility issues before merge." `
        -Problem "Developers use SQLite locally while production uses Postgres; drift is easy." `
        -Approach @(
            "GitHub Action service container for Postgres.",
            "Run prisma migrate deploy and a minimal smoke script.",
            "Optionally matrix SQLite + Postgres for speed vs fidelity."
        ) `
        -Acceptance @(
            "Failing migration fails CI with readable logs.",
            "Documented in CONTRIBUTING how to mirror CI locally.",
            "Secret-free workflow for forks."
        ) `
        -References @(
            ".github/workflows",
            "prisma/schema.prisma"
        ) `
        -OutOfScope "Full k6 load testing."),
    (New-Issue -Title "[Backend] Uniform JSON error envelope and request correlation" `
        -Track Backend -Stack $stackBe `
        -Summary "Clients and SREs should get predictable errors tied to log lines." `
        -Problem "Handlers may return ad-hoc shapes; debugging production without request id is painful." `
        -Approach @(
            "Define standard error JSON: code, message, details?, requestId.",
            "Middleware or helper in lib/api-helpers assigns X-Request-Id and propagates to lib/logger.",
            "Gradual migration: start with auth + circles routes."
        ) `
        -Acceptance @(
            "Documented error schema in OpenAPI.",
            "Response headers include request id on error paths.",
            "Frontend toasts can show correlation id in support mode (optional toggle)."
        ) `
        -References @(
            "lib/api-helpers.ts",
            "lib/logger.ts",
            "middleware.ts"
        )),

    # --- Smart contracts (12) ---
    (New-Issue -Title "[Contracts] Complete Soroban tests for AjoError branches" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Every documented error path should have a deterministic test." `
        -Problem "Untested revert paths risk regressions during refactors or upgrades." `
        -Approach @(
            "Enumerate AjoError variants in contracts/ajo-circle/src/lib.rs.",
            "For each, craft minimal test contract invocation that triggers the error.",
            "Add positive-path coverage for payouts, votes, dissolution transitions."
        ) `
        -Acceptance @(
            "cargo test passes in CI for contract workspace.",
            "Coverage report or checklist attached in PR description.",
            "No ignored tests without justification."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs",
            "contracts/ajo-circle/Cargo.toml"
        )),
    (New-Issue -Title "[Contracts] Storage and CPU optimization review" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Reduce gas and storage churn on hot paths." `
        -Problem "Redundant reads/writes increase cost and failure risk near Soroban limits." `
        -Approach @(
            "Profile hot functions (contribute, payout, vote tally updates).",
            "Cache CircleData fields in locals; avoid repeated env.storage() lookups where safe.",
            "Document before/after instruction counts if tooling allows."
        ) `
        -Acceptance @(
            "No behavior change in public semantics; all tests still pass.",
            "Brief write-up of wins and trade-offs in PR.",
            "Optional: micro-benchmark script."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        ) `
        -Risks "Premature optimization - measure first."),
    (New-Issue -Title "[Contracts] Emit structured contract events" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Indexers and the web app need reliable on-chain signals." `
        -Problem "Without events, off-chain reconciliation relies on heuristics or full ledger scans." `
        -Approach @(
            "Define events for contribution received, round advanced, payout sent, vote cast, dissolution state changes.",
            "Include circle id / contract id context and anonymized member keys as appropriate.",
            "Update README contract section with event schema."
        ) `
        -Acceptance @(
            "Events visible in Soroban RPC responses for covered actions.",
            "Backward compatibility plan if upgrading deployed WASM.",
            "Frontend/backend issues linked for consumption."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        )),
    (New-Issue -Title "[Contracts] External security review: token and auth invariants" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Third-party eyes on fund safety before mainnet." `
        -Problem "Token transfers and require_auth boundaries are high risk categories." `
        -Approach @(
            "Prepare threat model: asset theft, unauthorized organizer actions, vote manipulation, reentrancy analogs.",
            "Engage reviewer or bounty; share test suite and deployment plan.",
            "Track findings to remediation issues."
        ) `
        -Acceptance @(
            "Review report stored in private docs or GitHub Security advisories as appropriate.",
            "All critical/high issues resolved or explicitly accepted with rationale.",
            "Key invariants listed in README."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        )),
    (New-Issue -Title "[Contracts] WASM upgrade and migration policy" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Document how circles behave across contract upgrades." `
        -Problem "Users may assume immutable logic; upgrades need clear consent and operational steps." `
        -Approach @(
            "Decide: one WASM per circle instance vs upgradeable pattern; document trade-offs.",
            "If migrations exist, spell out multisig, voting, timelines, and communication plan.",
            "Align with backend reconciliation issue."
        ) `
        -Acceptance @(
            "Published ops doc linked from README smart contract section.",
            "Checklist for version bumps (testnet soak, hashes pinned).",
            "Legal/disclaimer note if community funds migrate."
        ) `
        -References @(
            "README.md",
            "contracts/ajo-circle"
        )),
    (New-Issue -Title "[Contracts] Property / fuzz tests for payout rotation" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Prove rotation invariants under randomized member sets." `
        -Problem "Subtle bugs in shuffle or rotation could skip or double-pay members." `
        -Approach @(
            "Model rotation as pure function where possible for fast property tests.",
            "Generate random member lists within MAX_MEMBERS bounds; assert bijection on indices across rounds.",
            "Integrate with cargo fuzz or quickcheck-style harness if feasible."
        ) `
        -Acceptance @(
            "Thousands of randomized runs in CI or nightly job.",
            "Document seed strategy for reproducibility on failure.",
            "Link failing seeds as regression tests."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        )),
    (New-Issue -Title "[Contracts] Organizer vs member capability matrix + tests" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Every privileged entrypoint should be explicitly documented and tested." `
        -Problem "Unclear roles lead to accidental centralization or missed require_auth checks." `
        -Approach @(
            "Build matrix table: function × required role (organizer, member, any).",
            "Add negative tests where unauthorized signer must fail with Unauthorized.",
            "Publish matrix in contracts/ajo-circle/README or root README."
        ) `
        -Acceptance @(
            "100% coverage of privileged functions in matrix.",
            "Tests fail if new privileged fn ships without matrix row.",
            "Reviewed by second engineer."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        )),
    (New-Issue -Title "[Contracts] Align HARD_CAP / MAX_MEMBERS with backend constants" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Single documented mapping between chain limits and API validation." `
        -Problem "Divergent limits confuse users and break idempotent UX flows." `
        -Approach @(
            "Export constants from contract build metadata or manual sync checklist per release.",
            "Coordinate with Backend validation issue; add CI check comparing literals (script).",
            "Version comment in both code paths referencing contract tag."
        ) `
        -Acceptance @(
            "Automated or documented manual gate before release.",
            "Release notes mention when limits change.",
            "Cross-links between issues resolved in same milestone."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs",
            "lib/validations/circle.ts"
        )),
    (New-Issue -Title "[Contracts] CI: Soroban build + test on every PR" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Prevent merging broken Rust/WASM." `
        -Problem "Contract changes can break without Node app noticing." `
        -Approach @(
            "GitHub Action with pinned Rust + Soroban CLI versions.",
            "Run cargo fmt --check (if applicable), cargo clippy, cargo test, and soroban contract build.",
            "Cache toolchain for speed."
        ) `
        -Acceptance @(
            "Required check on default branch PRs.",
            "Failure logs actionable within five minutes.",
            "Document local matching versions."
        ) `
        -References @(
            "contracts/ajo-circle/Cargo.toml",
            ".github/workflows"
        )),
    (New-Issue -Title "[Contracts] Mainnet readiness checklist (fees, footprint, assets)" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Operational readiness before real funds touch the contract." `
        -Problem "Testnet assumptions (free XLM, loose limits) do not carry over." `
        -Approach @(
            "Footprint/budget analysis for worst-case txs; fee sponsorship plan if using.",
            "Asset allowlist policy (USDC vs XLM) and decimal verification.",
            "Incident contacts + pause/upgrade policy cross-links."
        ) `
        -Acceptance @(
            "Checklist signed off by maintainer team.",
            "Published in repo docs or wiki.",
            "Testnet soak duration recorded."
        ) `
        -References @(
            "README.md",
            "contracts/ajo-circle"
        )),
    (New-Issue -Title "[Contracts] Integration tests: late contribution and round rollover" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Validate time-bound behavior against real or simulated ledger time." `
        -Problem "Edge cases around RoundDeadline may only appear under clock movement." `
        -Approach @(
            "Use Soroban test utilities or testnet scenarios to advance time or mock env.",
            "Cases: missed payment, extension policy (if any), round boundary double actions.",
            "Capture expected AjoError or state snapshots."
        ) `
        -Acceptance @(
            "Documented scenarios pass reproducibly.",
            "Linked to product policy for late payments.",
            "No flaky time-based tests without bounded retries."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        )),
    (New-Issue -Title "[Contracts] Static analysis / formal methods evaluation" `
        -Track "Smart Contracts" -Stack $stackSc `
        -Summary "Explore additional assurance beyond tests for fund-moving code." `
        -Problem "Tests alone may miss state-space bugs in voting and payouts." `
        -Approach @(
            "Survey Soroban/Rust tooling (MIRAI, Kani, custom assertions) applicability.",
            "Pick one low-effort win (e.g. overflow checks, invariant asserts) or document why deferred.",
            "Time-box spike to 1-2 days."
        ) `
        -Acceptance @(
            "Written decision record in contracts/ or ADR folder.",
            "If tooling adopted, runs in CI or nightly.",
            "Outcomes linked from security review issue."
        ) `
        -References @(
            "contracts/ajo-circle/src/lib.rs"
        ) `
        -OutOfScope "Full formal proof of entire contract in this iteration.")
)

if ($issues.Count -ne 40) {
    Write-Error "Expected 40 issues, got $($issues.Count). Fix script data."
}

$n = 0
foreach ($issue in $issues) {
    $n++
    if ($DryRun) {
        Write-Host "[$n/$($issues.Count)] DRY-RUN $($issue.title)"
        continue
    }
    Write-Host "[$n/$($issues.Count)] $($issue.title)"
    & $gh issue create --repo $Repo --title $issue.title --body $issue.body
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create issue: $($issue.title)"
    }
    Start-Sleep -Milliseconds 500
}

if ($DryRun) {
    Write-Host "Dry run finished. $($issues.Count) issue definitions OK. Run without -DryRun after gh auth login."
} else {
    Write-Host "Done. Created $($issues.Count) issues on $Repo."
}
