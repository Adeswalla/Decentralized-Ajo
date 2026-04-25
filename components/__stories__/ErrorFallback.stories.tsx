import type { Meta, StoryObj } from '@storybook/react';
import { ErrorFallback } from '../error-fallback';

/**
 * ErrorFallback Component Stories
 * 
 * The ErrorFallback component is used with React Error Boundaries to display
 * user-friendly error messages when components fail to render.
 * 
 * Key features:
 * - Displays error message to user
 * - Provides "Retry" button to recover from error
 * - Clean, centered UI that fits any layout
 * - Accessible error state rendering
 */
const meta = {
  title: 'Components/ErrorFallback',
  component: ErrorFallback,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Error boundary fallback component for graceful error handling.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Generic error with simple message
 */
export const Default: Story = {
  args: {
    error: new Error('Failed to load'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Network error - common in data fetching
 */
export const NetworkError: Story = {
  args: {
    error: new Error('Failed to fetch circles. Please check your connection and try again.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * API error - server-side issue
 */
export const APIError: Story = {
  args: {
    error: new Error('Server error: Unable to process your request. Please try again later.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Timeout error - long-running operation failed
 */
export const TimeoutError: Story = {
  args: {
    error: new Error('Request timeout. The operation took too long. Please try again.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Validation error - user input issue
 */
export const ValidationError: Story = {
  args: {
    error: new Error('Invalid amount. Please enter a number between 0.1 and 10000.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Component render error
 */
export const ComponentRenderError: Story = {
  args: {
    error: new Error('Unable to render proposal card. Missing required data.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Permission error - user not authorized
 */
export const PermissionError: Story = {
  args: {
    error: new Error('You do not have permission to perform this action.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Not found error - resource does not exist
 */
export const NotFoundError: Story = {
  args: {
    error: new Error('Circle not found. It may have been deleted or you may not have access.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Very long error message
 */
export const LongErrorMessage: Story = {
  args: {
    error: new Error(
      'Failed to process your payment. This could be due to insufficient balance in your wallet, network connectivity issues, or a temporary service outage. Please verify your wallet has sufficient funds, check your internet connection, and try again.'
    ),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * With interactive retry
 */
export const Interactive: Story = {
  render: (args) => {
    const handleRetry = () => {
      alert('Retry action triggered');
      args.resetErrorBoundary?.();
    };

    return (
      <ErrorFallback error={args.error} resetErrorBoundary={handleRetry} />
    );
  },
  args: {
    error: new Error('Failed to load circles. Click retry to try again.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Minimal error - single word
 */
export const MinimalError: Story = {
  args: {
    error: new Error('Timeout'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Error in data loading context
 */
export const DataLoadingError: Story = {
  args: {
    error: new Error('Failed to load transaction history. Your data will appear here once loaded.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Error in form submission
 */
export const FormSubmissionError: Story = {
  args: {
    error: new Error('Failed to submit form. Please check your input and try again.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Wallet connection error
 */
export const WalletError: Story = {
  args: {
    error: new Error('Unable to connect wallet. Please ensure your wallet extension is installed and try again.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};

/**
 * Smart contract error
 */
export const SmartContractError: Story = {
  args: {
    error: new Error('Transaction failed on the blockchain. Insufficient gas or contract error.'),
    resetErrorBoundary: () => console.log('Retry clicked'),
  },
};
