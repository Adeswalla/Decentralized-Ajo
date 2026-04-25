'use client';

import { useState } from 'react';
import { AmountInput } from '@/components/ui/amount-input';
import { ProposalCard } from '@/components/governance/proposal-card';
import { ErrorFallback } from '@/components/error-fallback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Components Showcase Page
 * 
 * This page demonstrates critical UI components with various states and configurations.
 * It serves as live documentation for component behavior and styling.
 * 
 * Access this page at: /components-showcase
 */

export default function ComponentsShowcase() {
  const [amountValue, setAmountValue] = useState('');
  const [error, setError] = useState<Error | null>(null);

  // Mock proposal data for stories
  const activeProposal = {
    id: 'prop-001',
    title: 'Increase Contribution Amount',
    description: 'This proposal suggests increasing the monthly contribution amount from 100 XLM to 150 XLM to build the circle reserves faster.',
    proposalType: 'CONTRIBUTION_ADJUSTMENT',
    status: 'ACTIVE' as const,
    votingStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    votingEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    requiredQuorum: 60,
    yesVotes: 18,
    noVotes: 5,
    abstainVotes: 2,
    totalVotes: 25,
    totalMembers: 30,
    userVote: null,
    quorumPercentage: 83,
  };

  const passedProposal = {
    ...activeProposal,
    id: 'prop-002',
    title: 'Emergency Payout Approval',
    status: 'PASSED' as const,
    votingEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    yesVotes: 22,
    noVotes: 3,
    quorumPercentage: 97,
  };

  const rejectedProposal = {
    ...activeProposal,
    id: 'prop-003',
    title: 'Reduce Contribution Amount',
    status: 'REJECTED' as const,
    votingEndDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    yesVotes: 8,
    noVotes: 15,
    quorumPercentage: 32,
  };

  const handleVote = async (proposalId: string, voteChoice: string) => {
    console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
    // Simulate API call
    return new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Component Showcase</h1>
          <p className="text-muted-foreground">
            Live documentation of critical UI components with various states and configurations.
          </p>
        </div>

        {/* Tabs for different components */}
        <Tabs defaultValue="amount-input" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="amount-input">Amount Input</TabsTrigger>
            <TabsTrigger value="proposal-card">Proposal Card</TabsTrigger>
            <TabsTrigger value="error-fallback">Error Fallback</TabsTrigger>
          </TabsList>

          {/* Amount Input Showcase */}
          <TabsContent value="amount-input" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AmountInput Component</CardTitle>
                <CardDescription>
                  A controlled numeric input for cryptocurrency amounts with balance validation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Default */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Default - XLM with Good Balance</h3>
                  <div className="max-w-sm">
                    <AmountInput
                      unit="XLM"
                      balance="1000.5"
                      onValueChange={setAmountValue}
                      placeholder="0.0000000"
                    />
                  </div>
                </div>

                {/* USDC Variant */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">USDC Variant with High Balance</h3>
                  <div className="max-w-sm">
                    <AmountInput
                      unit="USDC"
                      balance="500000.50"
                      onValueChange={() => {}}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Low Balance */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Low Balance State</h3>
                  <div className="max-w-sm">
                    <AmountInput
                      unit="XLM"
                      balance="10.5"
                      onValueChange={() => {}}
                      placeholder="0.0000000"
                    />
                  </div>
                </div>

                {/* Disabled State */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Disabled State</h3>
                  <div className="max-w-sm">
                    <AmountInput
                      unit="XLM"
                      balance="1000.5"
                      onValueChange={() => {}}
                      placeholder="0.0000000"
                      disabled={true}
                    />
                  </div>
                </div>

                {/* Zero Balance */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Zero Balance Edge Case</h3>
                  <div className="max-w-sm">
                    <AmountInput
                      unit="XLM"
                      balance="0"
                      onValueChange={() => {}}
                      placeholder="0.0000000"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
              <CardHeader>
                <CardTitle>Component Props</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold">unit: 'XLM' | 'USDC'</p>
                    <p className="text-muted-foreground">Asset type - determines decimal places</p>
                  </div>
                  <div>
                    <p className="font-semibold">balance: string | number</p>
                    <p className="text-muted-foreground">Available balance for the user</p>
                  </div>
                  <div>
                    <p className="font-semibold">onValueChange: (value: string) =&gt; void</p>
                    <p className="text-muted-foreground">Callback when user enters amount</p>
                  </div>
                  <div>
                    <p className="font-semibold">disabled?: boolean</p>
                    <p className="text-muted-foreground">Disable input and MAX button</p>
                  </div>
                  <div>
                    <p className="font-semibold">placeholder?: string</p>
                    <p className="text-muted-foreground">Input placeholder text</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Proposal Card Showcase */}
          <TabsContent value="proposal-card" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ProposalCard Component</CardTitle>
                <CardDescription>
                  Card component for displaying and voting on governance proposals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Active Proposal */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Active Proposal</h3>
                    <ProposalCard
                      proposal={activeProposal}
                      onVote={handleVote}
                      isWalletConnected={true}
                    />
                  </div>

                  {/* Passed Proposal */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Passed Proposal</h3>
                    <ProposalCard
                      proposal={passedProposal}
                      onVote={handleVote}
                      isWalletConnected={true}
                    />
                  </div>

                  {/* Rejected Proposal */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Rejected Proposal</h3>
                    <ProposalCard
                      proposal={rejectedProposal}
                      onVote={handleVote}
                      isWalletConnected={true}
                    />
                  </div>

                  {/* Active Proposal - Wallet Disconnected */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Active - Wallet Disconnected</h3>
                    <ProposalCard
                      proposal={activeProposal}
                      onVote={handleVote}
                      isWalletConnected={false}
                    />
                  </div>

                  {/* Already Voted */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Already Voted</h3>
                    <ProposalCard
                      proposal={{ ...activeProposal, userVote: 'YES' }}
                      onVote={handleVote}
                      isWalletConnected={true}
                    />
                  </div>

                  {/* High Abstention */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">High Abstention Rate</h3>
                    <ProposalCard
                      proposal={{
                        ...activeProposal,
                        yesVotes: 10,
                        noVotes: 8,
                        abstainVotes: 12,
                      }}
                      onVote={handleVote}
                      isWalletConnected={true}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
              <CardHeader>
                <CardTitle>Component Props</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold">proposal: Proposal</p>
                    <p className="text-muted-foreground">Proposal object with all voting data</p>
                  </div>
                  <div>
                    <p className="font-semibold">onVote: (proposalId: string, voteChoice: string) =&gt; Promise&lt;void&gt;</p>
                    <p className="text-muted-foreground">Callback when user submits vote</p>
                  </div>
                  <div>
                    <p className="font-semibold">isWalletConnected: boolean</p>
                    <p className="text-muted-foreground">Whether wallet is connected (enables voting)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Error Fallback Showcase */}
          <TabsContent value="error-fallback" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ErrorFallback Component</CardTitle>
                <CardDescription>
                  Error boundary fallback component for graceful error handling.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Generic Error */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Generic Error</h3>
                  <ErrorFallback
                    error={new Error('Failed to load')}
                    resetErrorBoundary={() => setError(null)}
                  />
                </div>

                {/* Network Error */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Network Error</h3>
                  <ErrorFallback
                    error={new Error('Failed to fetch circles. Please check your connection and try again.')}
                    resetErrorBoundary={() => setError(null)}
                  />
                </div>

                {/* API Error */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">API Error</h3>
                  <ErrorFallback
                    error={new Error('Server error: Unable to process your request. Please try again later.')}
                    resetErrorBoundary={() => setError(null)}
                  />
                </div>

                {/* Timeout Error */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Timeout Error</h3>
                  <ErrorFallback
                    error={new Error('Request timeout. The operation took too long. Please try again.')}
                    resetErrorBoundary={() => setError(null)}
                  />
                </div>

                {/* Validation Error */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Validation Error</h3>
                  <ErrorFallback
                    error={new Error('Invalid amount. Please enter a number between 0.1 and 10000.')}
                    resetErrorBoundary={() => setError(null)}
                  />
                </div>

                {/* Long Error Message */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Long Error Message</h3>
                  <ErrorFallback
                    error={new Error(
                      'Failed to process your payment. This could be due to insufficient balance in your wallet, network connectivity issues, or a temporary service outage. Please verify your wallet has sufficient funds, check your internet connection, and try again.'
                    )}
                    resetErrorBoundary={() => setError(null)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
              <CardHeader>
                <CardTitle>Component Props</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold">error: Error</p>
                    <p className="text-muted-foreground">Error object with message to display</p>
                  </div>
                  <div>
                    <p className="font-semibold">resetErrorBoundary: () =&gt; void</p>
                    <p className="text-muted-foreground">Callback when user clicks Retry button</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Example */}
            <Card>
              <CardHeader>
                <CardTitle>Usage with Error Boundary</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded overflow-auto text-sm">
{`import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error-fallback';

export function MyComponent() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {/* Your component content */}
    </ErrorBoundary>
  );
}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Installation Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Running with Storybook</CardTitle>
            <CardDescription>
              For an interactive component explorer with hot reload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded overflow-auto text-sm">
{`# Install dependencies (one-time setup)
npm install -D --legacy-peer-deps storybook @storybook/react @storybook/nextjs

# Run Storybook
npm run storybook

# Storybook will open at http://localhost:6006`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
