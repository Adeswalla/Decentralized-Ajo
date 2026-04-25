import type { Meta, StoryObj } from '@storybook/react';
import { ProposalCard } from '../governance/proposal-card';
import { useState } from 'react';

/**
 * ProposalCard Component Stories
 * 
 * The ProposalCard component renders governance proposals with voting functionality.
 * It displays proposal details, vote tallies, quorum progress, and vote submission.
 * 
 * Key features:
 * - Vote tally visualization (Yes/No/Abstain)
 * - Quorum progress tracking
 * - Voting time remaining countdown
 * - Wallet connection detection
 * - Vote state management (user can vote only once)
 */
const meta = {
  title: 'Components/ProposalCard',
  component: ProposalCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A card component for displaying and voting on governance proposals.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProposalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock proposal data
const mockProposal = {
  id: 'prop-001',
  title: 'Increase Contribution Amount',
  description: 'This proposal suggests increasing the monthly contribution amount from 100 XLM to 150 XLM to build the circle reserves faster.',
  proposalType: 'CONTRIBUTION_ADJUSTMENT',
  status: 'ACTIVE',
  votingStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  votingEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
  requiredQuorum: 60,
  yesVotes: 18,
  noVotes: 5,
  abstainVotes: 2,
  totalVotes: 25,
  totalMembers: 30,
  userVote: null,
  quorumPercentage: 83,
};

/**
 * Active proposal ready for voting
 * - Quorum already met (83% > 60%)
 * - User can still vote
 * - Voting window is open
 */
export const Active: Story = {
  args: {
    proposal: mockProposal,
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Active proposal with close voting deadline
 * - Voting ends in less than 1 hour
 */
export const CloseToDeadline: Story = {
  args: {
    proposal: {
      ...mockProposal,
      votingEndDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Passed proposal - voting ended successfully
 * - Quorum met and has more yes votes than no votes
 * - No voting interface shown
 */
export const Passed: Story = {
  args: {
    proposal: {
      ...mockProposal,
      status: 'PASSED',
      votingEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      yesVotes: 22,
      noVotes: 3,
      quorumPercentage: 97,
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Rejected proposal - failed quorum or too many no votes
 */
export const Rejected: Story = {
  args: {
    proposal: {
      ...mockProposal,
      status: 'REJECTED',
      votingEndDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      yesVotes: 8,
      noVotes: 15,
      quorumPercentage: 32,
      requiredQuorum: 60,
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * User already voted - shows "You voted" indicator
 * - No voting buttons displayed
 */
export const UserAlreadyVoted: Story = {
  args: {
    proposal: {
      ...mockProposal,
      userVote: 'YES',
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Wallet disconnected - user cannot vote
 * - Warning message shown
 * - Vote buttons hidden
 */
export const WalletDisconnected: Story = {
  args: {
    proposal: mockProposal,
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: false,
  },
};

/**
 * Quorum not met yet
 * - Shows low quorum percentage
 * - Users can still vote to reach quorum
 */
export const QuorumNotMet: Story = {
  args: {
    proposal: {
      ...mockProposal,
      yesVotes: 5,
      noVotes: 2,
      abstainVotes: 1,
      totalVotes: 8,
      quorumPercentage: 27, // 27% < 60% required
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * One-sided voting - all yes votes
 * - Unanimity scenario
 */
export const UnanimousYes: Story = {
  args: {
    proposal: {
      ...mockProposal,
      yesVotes: 28,
      noVotes: 0,
      abstainVotes: 2,
      totalVotes: 30,
      quorumPercentage: 100,
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * High abstention rate
 * - Shows significant abstention votes
 */
export const HighAbstention: Story = {
  args: {
    proposal: {
      ...mockProposal,
      yesVotes: 10,
      noVotes: 8,
      abstainVotes: 12,
      totalVotes: 30,
      quorumPercentage: 75,
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Emergency payout proposal
 */
export const EmergencyPayout: Story = {
  args: {
    proposal: {
      ...mockProposal,
      id: 'prop-emergency-001',
      title: 'Emergency Payout Request',
      description: 'Member requesting emergency payout due to urgent medical expenses. Amount: 500 XLM.',
      proposalType: 'EMERGENCY_PAYOUT',
      yesVotes: 24,
      noVotes: 1,
      quorumPercentage: 94,
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Member removal proposal - contentious vote
 */
export const MemberRemoval: Story = {
  args: {
    proposal: {
      ...mockProposal,
      id: 'prop-removal-001',
      title: 'Remove Member - Missed 3 Contributions',
      description: 'Propose removal of member @JohnDoe who has missed 3 consecutive contributions without notice.',
      proposalType: 'MEMBER_REMOVAL',
      yesVotes: 14,
      noVotes: 11,
      quorumPercentage: 85,
    },
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};

/**
 * Interactive story with voting simulation
 */
export const Interactive: Story = {
  render: (args) => {
    const [proposal, setProposal] = useState(mockProposal);
    const [voted, setVoted] = useState(false);

    const handleVote = async (proposalId: string, voteChoice: string) => {
      // Simulate vote submission
      const updatedProposal = {
        ...proposal,
        userVote: voteChoice,
        totalVotes: proposal.totalVotes + 1,
      };

      if (voteChoice === 'YES') {
        updatedProposal.yesVotes = proposal.yesVotes + 1;
      } else if (voteChoice === 'NO') {
        updatedProposal.noVotes = proposal.noVotes + 1;
      } else {
        updatedProposal.abstainVotes = proposal.abstainVotes + 1;
      }

      // Update quorum
      updatedProposal.quorumPercentage = Math.round(
        (updatedProposal.totalVotes / updatedProposal.totalMembers) * 100
      );

      setProposal(updatedProposal);
      setVoted(true);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    };

    return (
      <div className="space-y-4">
        <ProposalCard
          proposal={proposal}
          onVote={handleVote}
          isWalletConnected={args.isWalletConnected}
        />
        {voted && (
          <div className="p-4 rounded bg-green-50 border border-green-200">
            <p className="text-sm text-green-800">✓ Your vote has been recorded!</p>
          </div>
        )}
      </div>
    );
  },
  args: {
    proposal: mockProposal,
    onVote: async (proposalId, voteChoice) => {
      console.log(`Voted ${voteChoice} on proposal ${proposalId}`);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    isWalletConnected: true,
  },
};
