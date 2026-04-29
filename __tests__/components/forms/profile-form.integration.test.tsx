/**
 * Profile Form Integration Tests
 * Tests multi-field form interaction, validation, and submission
 * Closes #584
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ProfileForm } from '@/components/profile-form';

// Mock dependencies
jest.mock('@/lib/auth-client', () => ({
  authenticatedFetch: jest.fn(),
  clearAuthState: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, isLoading, ...props }: any) => (
    <button disabled={disabled || isLoading} {...props}>
      {isLoading ? 'Loading...' : children}
    </button>
  ),
}));

const mockAuthenticatedFetch = require('@/lib/auth-client').authenticatedFetch;
const mockClearAuthState = require('@/lib/auth-client').clearAuthState;

describe('ProfileForm Integration Tests', () => {
  const initialData = {
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    notificationEmail: 'john@example.com',
    phoneNumber: '+1234567890',
    bio: 'Test bio',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => JSON.stringify({ id: 1, email: 'test@example.com' })),
        setItem: jest.fn(),
      },
      writable: true,
    });
  });

  describe('Multi-field form interaction', () => {
    it('should handle filling multiple fields correctly', async () => {
      const onSuccess = jest.fn();
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { ...initialData, firstName: 'Jane' } }),
      });

      render(<ProfileForm initialData={initialData} onSuccess={onSuccess} />);
      const user = userEvent.setup();

      // Update multiple fields
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Jane');

      await user.clear(screen.getByLabelText(/last name/i));
      await user.type(screen.getByLabelText(/last name/i), 'Smith');

      await user.clear(screen.getByLabelText(/preferred username/i));
      await user.type(screen.getByLabelText(/preferred username/i), 'janesmith');

      await user.clear(screen.getByLabelText(/notification email/i));
      await user.type(screen.getByLabelText(/notification email/i), 'jane@example.com');

      await user.clear(screen.getByLabelText(/phone number/i));
      await user.type(screen.getByLabelText(/phone number/i), '+9876543210');

      await user.clear(screen.getByLabelText(/bio/i));
      await user.type(screen.getByLabelText(/bio/i), 'Updated bio description');

      // Verify button is enabled (form is dirty)
      expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();

      // Submit form
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Jane',
            lastName: 'Smith',
            username: 'janesmith',
            notificationEmail: 'jane@example.com',
            phoneNumber: '+9876543210',
            bio: 'Updated bio description',
          }),
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Profile updated');
      expect(onSuccess).toHaveBeenCalledWith({ ...initialData, firstName: 'Jane' });
    });

    it('should maintain form state when fields are updated incrementally', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      // Update first name only
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Alice');

      // Verify only first name changed
      expect(screen.getByLabelText(/first name/i)).toHaveValue('Alice');
      expect(screen.getByLabelText(/last name/i)).toHaveValue('Doe');

      // Update last name
      await user.clear(screen.getByLabelText(/last name/i));
      await user.type(screen.getByLabelText(/last name/i), 'Johnson');

      // Verify both changes are maintained
      expect(screen.getByLabelText(/first name/i)).toHaveValue('Alice');
      expect(screen.getByLabelText(/last name/i)).toHaveValue('Johnson');
    });
  });

  describe('Validation error appearance and disappearance', () => {
    it('should show validation errors for required fields when invalid data is entered', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      // Clear first name (required field)
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'A'); // Too short

      // Trigger validation by blurring
      fireEvent.blur(screen.getByLabelText(/first name/i));

      await waitFor(() => {
        expect(screen.getByText('First name must be at least 2 characters')).toBeInTheDocument();
      });

      // Clear last name (required field)
      await user.clear(screen.getByLabelText(/last name/i));
      await user.type(screen.getByLabelText(/last name/i), 'B'); // Too short

      fireEvent.blur(screen.getByLabelText(/last name/i));

      await waitFor(() => {
        expect(screen.getByText('Last name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText(/notification email/i));
      await user.type(screen.getByLabelText(/notification email/i), 'invalid-email');
      fireEvent.blur(screen.getByLabelText(/notification email/i));

      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid username format', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText(/preferred username/i));
      await user.type(screen.getByLabelText(/preferred username/i), 'invalid username!');
      fireEvent.blur(screen.getByLabelText(/preferred username/i));

      await waitFor(() => {
        expect(screen.getByText('Only letters, numbers, underscores, and hyphens')).toBeInTheDocument();
      });
    });

    it('should show validation error for bio being too long', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      const longBio = 'a'.repeat(161);
      await user.clear(screen.getByLabelText(/bio/i));
      await user.type(screen.getByLabelText(/bio/i), longBio);
      fireEvent.blur(screen.getByLabelText(/bio/i));

      await waitFor(() => {
        expect(screen.getByText('Bio must be 160 characters or less')).toBeInTheDocument();
      });

      // Verify character count shows destructive color
      expect(screen.getByText('161/160')).toHaveClass('text-destructive');
    });

    it('should hide validation errors when valid data is entered', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      // Trigger error
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'A');
      fireEvent.blur(screen.getByLabelText(/first name/i));

      await waitFor(() => {
        expect(screen.getByText('First name must be at least 2 characters')).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'ValidName');
      fireEvent.blur(screen.getByLabelText(/first name/i));

      await waitFor(() => {
        expect(screen.queryByText('First name must be at least 2 characters')).not.toBeInTheDocument();
      });
    });

    it('should handle optional fields correctly (no validation errors when empty)', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      // Clear optional fields
      await user.clear(screen.getByLabelText(/preferred username/i));
      await user.clear(screen.getByLabelText(/notification email/i));
      await user.clear(screen.getByLabelText(/phone number/i));
      await user.clear(screen.getByLabelText(/bio/i));

      // Trigger blur events
      fireEvent.blur(screen.getByLabelText(/preferred username/i));
      fireEvent.blur(screen.getByLabelText(/notification email/i));
      fireEvent.blur(screen.getByLabelText(/phone number/i));
      fireEvent.blur(screen.getByLabelText(/bio/i));

      // Should not show any validation errors for optional fields
      expect(screen.queryByText(/must be at least/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
    });
  });

  describe('Form submission with valid data', () => {
    it('should submit successfully with all valid data', async () => {
      const onSuccess = jest.fn();
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { ...initialData, firstName: 'Updated' } }),
      });

      render(<ProfileForm initialData={initialData} onSuccess={onSuccess} />);
      const user = userEvent.setup();

      // Update a field to make form dirty
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Updated');

      // Submit form
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Updated',
            lastName: 'Doe',
            username: 'johndoe',
            notificationEmail: 'john@example.com',
            phoneNumber: '+1234567890',
            bio: 'Test bio',
          }),
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Profile updated');
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should handle API error responses correctly', async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Updated');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Server error');
      });

      // Button should be enabled again after error
      expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
    });

    it('should handle 401 unauthorized response', async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        status: 401,
      });

      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Updated');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockClearAuthState).toHaveBeenCalled();
        expect(window.location.href).toBe('/auth/login');
      });
    });

    it('should handle network errors gracefully', async () => {
      mockAuthenticatedFetch.mockRejectedValue(new Error('Network error'));

      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Updated');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('An error occurred. Please try again.');
      });
    });

    it('should disable submission when form is not dirty', async () => {
      render(<ProfileForm initialData={initialData} />);

      // Button should be disabled when form is not dirty
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();

      // Make form dirty
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Updated');

      // Button should be enabled
      expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
    });

    it('should show loading state during submission', async () => {
      mockAuthenticatedFetch.mockImplementation(() => new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ user: initialData }),
        }), 100)
      ));

      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText(/first name/i));
      await user.type(screen.getByLabelText(/first name/i), 'Updated');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Should show loading state
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
      }, { timeout: 200 });
    });
  });

  describe('Character counter functionality', () => {
    it('should update character count as user types in bio', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      // Initial bio length
      expect(screen.getByText('8/160')).toBeInTheDocument();

      await user.clear(screen.getByLabelText(/bio/i));
      await user.type(screen.getByLabelText(/bio/i), 'Hello');

      expect(screen.getByText('5/160')).toBeInTheDocument();

      await user.type(screen.getByLabelText(/bio/i), ' World');

      expect(screen.getByText('11/160')).toBeInTheDocument();
    });

    it('should show destructive color when approaching limit', async () => {
      render(<ProfileForm initialData={initialData} />);
      const user = userEvent.setup();

      const nearLimitBio = 'a'.repeat(145);
      await user.clear(screen.getByLabelText(/bio/i));
      await user.type(screen.getByLabelText(/bio/i), nearLimitBio);

      expect(screen.getByText('145/160')).toHaveClass('text-destructive');
    });
  });
});
