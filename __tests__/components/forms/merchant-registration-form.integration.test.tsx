/**
 * Merchant Registration Form Integration Tests
 * Tests multi-field form interaction, validation, and submission
 * Closes #584
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { MerchantRegistrationForm } from '@/components/merchant/merchant-registration-form';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, ...props }: any) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}));

describe('MerchantRegistrationForm Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-field form interaction', () => {
    it('should handle filling all required fields correctly', async () => {
      const onComplete = jest.fn();

      render(<MerchantRegistrationForm onComplete={onComplete} />);
      const user = userEvent.setup();

      // Fill in all required fields
      await user.type(screen.getByLabelText(/business name/i), 'Test Business');
      await user.type(screen.getByLabelText(/business description/i), 'This is a test business description that is at least 10 characters long');
      await user.type(screen.getByLabelText(/contact email/i), 'contact@testbusiness.com');
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');

      // Optional website field
      await user.type(screen.getByLabelText(/website/i), 'https://testbusiness.com');

      // Verify submit button is enabled
      expect(screen.getByRole('button', { name: /complete registration/i })).not.toBeDisabled();

      // Submit form
      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Merchant registration submitted successfully!');
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('should handle file upload for business logo', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Initially should show upload placeholder
      expect(screen.getByText(/png, jpg or svg/i)).toBeInTheDocument();

      // Create a mock file
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = screen.getByLabelText(/business logo/i);

      await user.upload(fileInput, file);

      // Should show logo preview (mock FileReader would be needed for full test)
      expect(fileInput.files).toHaveLength(1);
      expect(fileInput.files[0]).toBe(file);
    });

    it('should maintain form state when fields are updated incrementally', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Fill business name
      await user.type(screen.getByLabelText(/business name/i), 'Business');

      // Verify business name is maintained
      expect(screen.getByLabelText(/business name/i)).toHaveValue('Business');

      // Fill business description
      await user.type(screen.getByLabelText(/business description/i), ' description');

      // Verify both fields are maintained
      expect(screen.getByLabelText(/business name/i)).toHaveValue('Business');
      expect(screen.getByLabelText(/business description/i)).toHaveValue(' description');
    });
  });

  describe('Validation error appearance and disappearance', () => {
    it('should show validation errors for required fields when empty', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      await waitFor(() => {
        expect(screen.getByText('Business name must be at least 2 characters')).toBeInTheDocument();
        expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
        expect(screen.getByText('Must be a valid email')).toBeInTheDocument();
        expect(screen.getByText('Phone number must be at least 10 digits')).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid business name length', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/business name/i), 'A'); // Too short
      fireEvent.blur(screen.getByLabelText(/business name/i));

      await waitFor(() => {
        expect(screen.getByText('Business name must be at least 2 characters')).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(screen.getByLabelText(/business name/i));
      await user.type(screen.getByLabelText(/business name/i), 'Valid Business');
      fireEvent.blur(screen.getByLabelText(/business name/i));

      await waitFor(() => {
        expect(screen.queryByText('Business name must be at least 2 characters')).not.toBeInTheDocument();
      });
    });

    it('should show validation error for invalid business description length', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/business description/i), 'Short'); // Too short
      fireEvent.blur(screen.getByLabelText(/business description/i));

      await waitFor(() => {
        expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(screen.getByLabelText(/business description/i));
      await user.type(screen.getByLabelText(/business description/i), 'This is a valid business description');
      fireEvent.blur(screen.getByLabelText(/business description/i));

      await waitFor(() => {
        expect(screen.queryByText('Description must be at least 10 characters')).not.toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/contact email/i), 'invalid-email');
      fireEvent.blur(screen.getByLabelText(/contact email/i));

      await waitFor(() => {
        expect(screen.getByText('Must be a valid email')).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(screen.getByLabelText(/contact email/i));
      await user.type(screen.getByLabelText(/contact email/i), 'valid@example.com');
      fireEvent.blur(screen.getByLabelText(/contact email/i));

      await waitFor(() => {
        expect(screen.queryByText('Must be a valid email')).not.toBeInTheDocument();
      });
    });

    it('should show validation error for invalid phone number', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/contact phone/i), '123'); // Too short
      fireEvent.blur(screen.getByLabelText(/contact phone/i));

      await waitFor(() => {
        expect(screen.getByText('Phone number must be at least 10 digits')).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(screen.getByLabelText(/contact phone/i));
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');
      fireEvent.blur(screen.getByLabelText(/contact phone/i));

      await waitFor(() => {
        expect(screen.queryByText('Phone number must be at least 10 digits')).not.toBeInTheDocument();
      });
    });

    it('should show validation error for invalid website URL', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/website/i), 'invalid-url');
      fireEvent.blur(screen.getByLabelText(/website/i));

      await waitFor(() => {
        expect(screen.getByText('Must be a valid URL')).toBeInTheDocument();
      });

      // Fix the error with valid URL
      await user.clear(screen.getByLabelText(/website/i));
      await user.type(screen.getByLabelText(/website/i), 'https://example.com');
      fireEvent.blur(screen.getByLabelText(/website/i));

      await waitFor(() => {
        expect(screen.queryByText('Must be a valid URL')).not.toBeInTheDocument();
      });
    });

    it('should allow empty website field (optional)', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Fill required fields but leave website empty
      await user.type(screen.getByLabelText(/business name/i), 'Test Business');
      await user.type(screen.getByLabelText(/business description/i), 'This is a test business description that is at least 10 characters long');
      await user.type(screen.getByLabelText(/contact email/i), 'contact@testbusiness.com');
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');

      // Should not show website validation error
      expect(screen.queryByText('Must be a valid URL')).not.toBeInTheDocument();

      // Submit should succeed
      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });

    it('should hide multiple validation errors when all fields are corrected', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Trigger multiple errors
      await user.type(screen.getByLabelText(/business name/i), 'A');
      await user.type(screen.getByLabelText(/contact email/i), 'invalid');
      await user.type(screen.getByLabelText(/contact phone/i), '123');

      // Blur to trigger validation
      fireEvent.blur(screen.getByLabelText(/business name/i));
      fireEvent.blur(screen.getByLabelText(/contact email/i));
      fireEvent.blur(screen.getByLabelText(/contact phone/i));

      await waitFor(() => {
        expect(screen.getByText('Business name must be at least 2 characters')).toBeInTheDocument();
        expect(screen.getByText('Must be a valid email')).toBeInTheDocument();
        expect(screen.getByText('Phone number must be at least 10 digits')).toBeInTheDocument();
      });

      // Fix all errors
      await user.clear(screen.getByLabelText(/business name/i));
      await user.type(screen.getByLabelText(/business name/i), 'Valid Business');

      await user.clear(screen.getByLabelText(/contact email/i));
      await user.type(screen.getByLabelText(/contact email/i), 'valid@example.com');

      await user.clear(screen.getByLabelText(/contact phone/i));
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');

      // Blur to trigger re-validation
      fireEvent.blur(screen.getByLabelText(/business name/i));
      fireEvent.blur(screen.getByLabelText(/contact email/i));
      fireEvent.blur(screen.getByLabelText(/contact phone/i));

      await waitFor(() => {
        expect(screen.queryByText('Business name must be at least 2 characters')).not.toBeInTheDocument();
        expect(screen.queryByText('Must be a valid email')).not.toBeInTheDocument();
        expect(screen.queryByText('Phone number must be at least 10 digits')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form submission with valid data', () => {
    it('should submit successfully with all valid data', async () => {
      const onComplete = jest.fn();

      render(<MerchantRegistrationForm onComplete={onComplete} />);
      const user = userEvent.setup();

      // Fill all required fields
      await user.type(screen.getByLabelText(/business name/i), 'Complete Business');
      await user.type(screen.getByLabelText(/business description/i), 'This is a complete business description that meets all requirements');
      await user.type(screen.getByLabelText(/contact email/i), 'complete@business.com');
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');
      await user.type(screen.getByLabelText(/website/i), 'https://completebusiness.com');

      // Submit form
      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Merchant registration submitted successfully!');
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('should handle submission errors gracefully', async () => {
      // Mock setTimeout to simulate API delay and error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback(); // Immediately call to simulate error
        return 1;
      });

      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Fill required fields
      await user.type(screen.getByLabelText(/business name/i), 'Test Business');
      await user.type(screen.getByLabelText(/business description/i), 'This is a test business description that is at least 10 characters long');
      await user.type(screen.getByLabelText(/contact email/i), 'contact@testbusiness.com');
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');

      // Mock the try-catch error scenario
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to submit registration');
      });

      consoleError.mockRestore();
      global.setTimeout = originalSetTimeout;
    });

    it('should show loading state during submission', async () => {
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn(() => 999); // Return a timeout ID

      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Fill required fields
      await user.type(screen.getByLabelText(/business name/i), 'Test Business');
      await user.type(screen.getByLabelText(/business description/i), 'This is a test business description that is at least 10 characters long');
      await user.type(screen.getByLabelText(/contact email/i), 'contact@testbusiness.com');
      await user.type(screen.getByLabelText(/contact phone/i), '+1234567890');

      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
      });

      global.setTimeout = originalSetTimeout;
    });

    it('should prevent submission when validation errors are present', async () => {
      render(<MerchantRegistrationForm />);
      const user = userEvent.setup();

      // Fill with invalid data
      await user.type(screen.getByLabelText(/business name/i), 'A');
      await user.type(screen.getByLabelText(/business description/i), 'Short');
      await user.type(screen.getByLabelText(/contact email/i), 'invalid');
      await user.type(screen.getByLabelText(/contact phone/i), '123');

      // Try to submit
      await user.click(screen.getByRole('button', { name: /complete registration/i }));

      // Should show validation errors and not call success
      await waitFor(() => {
        expect(screen.getByText('Business name must be at least 2 characters')).toBeInTheDocument();
        expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
        expect(screen.getByText('Must be a valid email')).toBeInTheDocument();
        expect(screen.getByText('Phone number must be at least 10 digits')).toBeInTheDocument();
      });

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('Form accessibility and UX', () => {
    it('should have proper form structure and labels', () => {
      render(<MerchantRegistrationForm />);

      // Check for proper form structure
      expect(screen.getByRole('form')).toBeInTheDocument();

      // Check for proper labels
      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/business description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contact phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/business logo/i)).toBeInTheDocument();
    });

    it('should mark required fields visually', () => {
      render(<MerchantRegistrationForm />);

      // Check for required field indicators
      expect(screen.getByText(/business name \*/i)).toBeInTheDocument();
      expect(screen.getByText(/business description \*/i)).toBeInTheDocument();
      expect(screen.getByText(/contact email \*/i)).toBeInTheDocument();
      expect(screen.getByText(/contact phone \*/i)).toBeInTheDocument();

      // Website should not be marked as required
      expect(screen.queryByText(/website \*/i)).not.toBeInTheDocument();
    });

    it('should provide helpful placeholder text', () => {
      render(<MerchantRegistrationForm />);

      expect(screen.getByPlaceholderText(/enter your business name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/describe your business/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/contact@business.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/https:\/\/example.com/i)).toBeInTheDocument();
    });
  });
});
