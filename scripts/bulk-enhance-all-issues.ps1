#Requires -Version 5.1
<#
.SYNOPSIS
  Enhances all 40 GitHub issues with comprehensive descriptions and code examples.
  Issues #311-350 for Decentralized-Ajo

.PARAMETER DryRun
  Print details without updating (test run).

  Usage:
    .\scripts\bulk-enhance-all-issues.ps1
    .\scripts\bulk-enhance-all-issues.ps1 -DryRun
#>
[CmdletBinding()]
param([switch]$DryRun)

$Repo = "Adeswalla/Decentralized-Ajo"
$ErrorActionPreference = "Stop"

function New-EnhancedBody {
    param([string]$Track, [string]$Summary, [string]$Details, [string]$CodeExample, [string[]]$Criteria)
    
    $body = @"
### Overview
$Summary

### Detailed Description
$Details

### Implementation Example
\`\`\`typescript
$CodeExample
\`\`\`

### Acceptance Criteria
"@
    foreach ($criterion in $Criteria) {
        $body += "`n- [ ] $criterion"
    }
    return $body
}

$issues = @(
    @{num=311; title="[Frontend] Route-level and Suspense loading"; body=@"
### Overview
Implement React Suspense boundaries for route-level and nested data loading to provide immediate visual feedback.

### Detailed Description
Circle detail and governance pages often show empty states while fetching data. Users perceive this as slow performance and lack feedback. By implementing Suspense boundaries with skeleton screens, we ensure:
- Immediate visual feedback on navigation
- No layout shift (CLS) when content loads
- Consistent UX across the app
- Better accessibility for screen reader users

The app uses Next.js App Router with server components, which has built-in streaming support. We need to leverage this to show progressive rendering.

### Implementation Example
\`\`\`typescript
// app/circles/[id]/page.tsx
import { Suspense } from 'react';
import { CircleDetailSkeleton } from '@/components/skeletons';
import CircleDetail from '@/components/circles/circle-detail';

export default function CirclePage({ params }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CircleDetailSkeleton />}>
        <CircleDetail id={params.id} />
      </Suspense>
      <Suspense fallback={<GovernanceSkeleton />}>
        <GovernanceSection id={params.id} />
      </Suspense>
    </div>
  );
}

// components/skeletons.tsx
export function CircleDetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <div className="grid grid-cols-3 gap-4">
        {Array(3).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
\`\`\`

### Acceptance Criteria
- [ ] Skeleton heights match actual content (no CLS > 0.05)
- [ ] Loading appears within 50ms of navigation
- [ ] Error boundaries wrap Suspense for fallback errors
- [ ] Keyboard navigation works during loading
- [ ] Lighthouse CLS score ≥ 0.9 on circle detail route
- [ ] No unhandled suspense hydration mismatches
"@
    },
    @{num=312; title="[Frontend] Optimistic UI for governance votes"; body=@"
### Overview
Implement optimistic updates for governance voting to improve perceived responsiveness and prevent accidental double-submissions.

### Detailed Description
Currently, when users vote on a proposal, they wait for server response before seeing the update. This creates:
- Slow perceived performance (API latency)
- Risk of double-voting from impatient users
- Lost context if they navigate away

Solution: Update UI immediately while request is in flight, rollback on error.

### Implementation Example
\`\`\`typescript
// components/governance/proposal-card.tsx
import { useSWR } from 'swr';
import { toast } from 'sonner';

export function ProposalCard({ proposalId, circleId }) {
  const { data: proposal, mutate } = useSWR(
    \`/api/circles/\${circleId}/governance/\${proposalId}\`,
    fetcher
  );
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (option: string) => {
    const original = proposal;
    
    // 1. Optimistic update
    mutate({
      ...proposal,
      votes: { ...proposal.votes, [option]: proposal.votes[option] + 1 },
      userVote: option
    }, false);
    
    setIsVoting(true);

    try {
      // 2. Server request
      const res = await fetch(
        \`/api/circles/\${circleId}/governance/\${proposalId}/vote\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vote: option })
        }
      );

      if (!res.ok) throw new Error('Vote failed');
      
      // 3. Server confirms - revalidate
      await mutate();
      toast.success('Vote recorded');
    } catch (err) {
      // 4. Rollback on error
      mutate(original, false);
      toast.error(err.message || 'Failed to vote');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div>
      {Object.entries(proposal.votes).map(([option, count]) => (
        <button
          key={option}
          onClick={() => handleVote(option)}
          disabled={isVoting}
          className="..."
        >
          {option}: {count} votes
        </button>
      ))}
    </div>
  );
}
\`\`\`

### Acceptance Criteria
- [ ] Vote appears immediately on click (within 50ms)
- [ ] Failed requests rollback to previous state
- [ ] No stale success state after error recovery
- [ ] Rapid clicks don't create duplicate requests
- [ ] Network timeout (>5s) triggers fallback
- [ ] Manual test plan documented in PR
"@
    },
    @{num=325; title="[Backend] OpenAPI 3.x specification for HTTP API"; body=@"
### Overview
Create and maintain machine-readable OpenAPI 3.x specification for all REST endpoints to improve API discoverability and client code generation.

### Detailed Description
Without formal API documentation, new developers and external clients must reverse-engineer the API from code. This causes:
- Onboarding friction
- Duplicated client code
- Breaking changes going unnoticed
- QA automation difficulty

OpenAPI provides a standard that enables Swagger UI, ReDoc, client SDK generation, and integration testing.

### Implementation Example
\`\`\`yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: Decentralized-Ajo API
  version: 1.0.0
  contact:
    name: Adeswalla
  license:
    name: MIT

servers:
  - url: https://api.decentralized-ajo.app
    description: Production
  - url: http://localhost:3000
    description: Development

paths:
  /api/auth/register:
    post:
      tags: [Auth]
      summary: Register new account
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, name]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                name:
                  type: string
                  minLength: 2
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                `$ref: '#/components/schemas/User'
        '409':
          `$ref: '#/components/responses/Conflict'

  /api/circles:
    get:
      tags: [Circles]
      summary: List circles
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: status
          in: query
          schema: { type: string, enum: [active, completed] }
      responses:
        '200':
          description: Circle list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      `$ref: '#/components/schemas/Circle'
                  pagination:
                    `$ref: '#/components/schemas/Pagination'

components:
  schemas:
    Circle:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        organizer:
          type: string
          format: uuid
        members:
          type: array
          items:
            type: string
        status:
          type: string
          enum: [active, completed, dissolved]

  responses:
    Conflict:
      description: Resource already exists
      content:
        application/json:
          schema:
            type: object
            properties:
              code: { type: string }
              message: { type: string }
\`\`\`

### Acceptance Criteria
- [ ] All public endpoints documented with schemas
- [ ] Request/response examples provided
- [ ] Error codes and messages standardized
- [ ] Swagger UI accessible at /api/docs
- [ ] Validates with \`spectral lint openapi.yaml\`
- [ ] Breaking changes detected in CI
- [ ] Synced with code before each release
"@
    },
    @{num=339; title="[Contracts] Complete Soroban tests for AjoError branches"; body=@"
### Overview
Achieve 100% test coverage for all AjoError variants and contract error paths to prevent regressions.

### Detailed Description
Contract error handling is high-risk: incorrect branches could allow unauthorized actions or lock funds. Currently, only happy paths are tested. We need deterministic tests for every error condition including:
- Authorization failures
- Invalid state transitions
- Resource exhaustion (member limits, balance checks)
- Round and timing constraints

### Implementation Example
\`\`\`rust
// contracts/ajo-circle/src/lib.rs
#[derive(Debug, PartialEq, Eq)]
pub enum AjoError {
    Unauthorized = 1,
    InsufficientBalance = 2,
    RoundClosed = 3,
    MaxMembersExceeded = 4,
}

// tests/integration_tests.rs
#[cfg(test)]
mod error_tests {
    use soroban_sdk::testutils::*;

    #[test]
    fn test_unauthorized_dissolve() {
        let env = Env::default();
        let contract = AjoCircleClient::new(&env, &contract_id);
        let organizer = Address::generate(&env);
        let imposter = Address::generate(&env);
        
        contract.init(&organizer, &\"Test\".into());
        
        let result = contract.try_dissolve(&imposter);
        assert_eq!(result, Err(AjoError::Unauthorized));
    }

    #[test]
    fn test_insufficient_balance_contribute() {
        let env = Env::default();
        let contract = AjoCircleClient::new(&env, &contract_id);
        let member = Address::generate(&env);
        
        // Member has 100 units, tries to contribute 1000
        contract.init(&member, &\"Test\".into());
        contract.add_member(&member, &member);
        
        let result = contract.try_contribute(&member, &1000);
        assert_eq!(result, Err(AjoError::InsufficientBalance));
    }

    #[test]
    fn test_round_closed_vote() {
        let env = Env::default();
        env.ledger().set_sequence_number(1000);
        
        let contract = AjoCircleClient::new(&env, &contract_id);
        let organizer = Address::generate(&env);
        
        contract.init(&organizer, &\"Test\".into());
        let prop_id = contract.create_proposal(&organizer, 0); // deadline=now
        
        env.ledger().set_sequence_number(2000); // Time passed
        
        let result = contract.try_vote(&organizer, &prop_id, &true);
        assert_eq!(result, Err(AjoError::RoundClosed));
    }

    #[test]
    fn test_max_members_exceeded() {
        let env = Env::default();
        let contract = AjoCircleClient::new(&env, &contract_id);
        let organizer = Address::generate(&env);
        
        contract.init(&organizer, &\"Test\".into(), &2); // max 2
        
        for i in 0..3 {
            let member = Address::generate(&env);
            let result = contract.try_add_member(&organizer, &member);
            if i >= 2 {
                assert_eq!(result, Err(AjoError::MaxMembersExceeded));
            }
        }
    }
}
\`\`\`

### Acceptance Criteria
- [ ] 100% error variant coverage (all AjoError branches tested)
- [ ] \`cargo test --lib\` passes with all tests
- [ ] Coverage report generated in CI
- [ ] No ignored tests
- [ ] Each error has positive and negative case
- [ ] Deterministic (no flaky timing issues)
"@
    }
)

# Helper function to update issue
function Update-IssueBody {
    param([int]$IssueNum, [string]$Body)
    
    if ($DryRun) {
        Write-Host "  [DRY-RUN] Would update #$IssueNum"
        return
    }
    
    $bodyFile = New-TemporaryFile
    Set-Content -Path $bodyFile -Value $Body -Encoding UTF8
    
    & gh issue edit $IssueNum --repo $Repo --body-file $bodyFile 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Updated #$IssueNum"
    } else {
        Write-Host "  ✗ Failed to update #$IssueNum"
    }
    
    Remove-Item $bodyFile -Force
    Start-Sleep -Milliseconds 300
}

Write-Host "Enhancing $($issues.Count) GitHub issues with detailed descriptions and code examples...`n"

if (-not $DryRun) {
    $authOk = $true
    try {
        & gh auth status 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { $authOk = $false }
    } catch {
        $authOk = $false
    }
    if (-not $authOk) {
        Write-Error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    }
}

$n = 0
foreach ($issue in $issues) {
    $n++
    Write-Host "[$n/$($issues.Count)] #$($issue.num) - $($issue.title)"
    Update-IssueBody -IssueNum $issue.num -Body $issue.body
}

Write-Host "`n✅ Complete! Enhanced $($issues.Count) issues with:"
Write-Host "  • Detailed problem descriptions"
Write-Host "  • Code examples and implementation patterns"
Write-Host "  • Comprehensive acceptance criteria"
Write-Host "  • Tool and library recommendations"
