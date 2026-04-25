import type { Meta, StoryObj } from '@storybook/react';
import { AmountInput } from '../ui/amount-input';
import { useState } from 'react';

/**
 * AmountInput Component Stories
 * 
 * The AmountInput component is a specialized numeric input for cryptocurrency amounts.
 * It enforces decimal precision per asset type (e.g., XLM has 7 decimals).
 * 
 * Key features:
 * - Supports different asset units (XLM, USDC)
 * - Validates against available balance
 * - Provides quick "MAX" button for convenience
 * - Shows balance and error states
 */
const meta = {
  title: 'Components/AmountInput',
  component: AmountInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A controlled numeric input for cryptocurrency amounts with balance validation.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AmountInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state with XLM asset
 */
export const Default: Story = {
  args: {
    unit: 'XLM',
    balance: '1000.5',
    onValueChange: (value) => console.log('Value changed:', value),
    placeholder: '0.0000000',
    disabled: false,
  },
};

/**
 * USDC asset variant with higher balance
 */
export const WithUSBC: Story = {
  args: {
    unit: 'USDC',
    balance: '500000.50',
    onValueChange: (value) => console.log('Value changed:', value),
    placeholder: '0.00',
    disabled: false,
  },
};

/**
 * Low balance state - user has limited funds
 */
export const LowBalance: Story = {
  args: {
    unit: 'XLM',
    balance: '10.5',
    onValueChange: (value) => console.log('Value changed:', value),
    placeholder: '0.0000000',
    disabled: false,
  },
};

/**
 * Disabled state - input cannot be modified
 */
export const Disabled: Story = {
  args: {
    unit: 'XLM',
    balance: '1000.5',
    onValueChange: (value) => console.log('Value changed:', value),
    placeholder: '0.0000000',
    disabled: true,
  },
};

/**
 * Exceeds balance error state
 * This story demonstrates the component when user enters amount > available balance
 */
export const ExceedsBalance: Story = {
  render: (args) => {
    const [value, setValue] = useState('1500.5');
    return (
      <AmountInput
        {...args}
        onValueChange={(val) => {
          setValue(val);
          args.onValueChange?.(val);
        }}
      />
    );
  },
  args: {
    unit: 'XLM',
    balance: '1000.5',
    placeholder: '0.0000000',
    disabled: false,
  },
};

/**
 * Zero balance edge case
 */
export const ZeroBalance: Story = {
  args: {
    unit: 'XLM',
    balance: '0',
    onValueChange: (value) => console.log('Value changed:', value),
    placeholder: '0.0000000',
    disabled: false,
  },
};

/**
 * Scientific notation handling
 * Component converts scientific notation to plain decimal
 */
export const ScientificNotation: Story = {
  render: (args) => {
    const [value, setValue] = useState('1e-7');
    return (
      <AmountInput
        {...args}
        onValueChange={(val) => {
          setValue(val);
          args.onValueChange?.(val);
        }}
      />
    );
  },
  args: {
    unit: 'XLM',
    balance: '1000.5',
    placeholder: '0.0000000',
    disabled: false,
  },
};

/**
 * Large amount scenario
 */
export const LargeAmount: Story = {
  args: {
    unit: 'USDC',
    balance: '999999999.99',
    onValueChange: (value) => console.log('Value changed:', value),
    placeholder: '0.00',
    disabled: false,
  },
};

/**
 * Interactive story showing real-time value changes
 */
export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState('');

    return (
      <div className="space-y-4">
        <AmountInput
          {...args}
          onValueChange={(val) => {
            setValue(val);
            setFeedback(`Current value: ${val || '(empty)'}`);
            args.onValueChange?.(val);
          }}
        />
        <div className="p-4 rounded bg-muted">
          <p className="text-sm text-muted-foreground">{feedback}</p>
        </div>
      </div>
    );
  },
  args: {
    unit: 'XLM',
    balance: '1000.5',
    placeholder: '0.0000000',
    disabled: false,
  },
};
