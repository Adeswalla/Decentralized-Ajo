/**
 * Test suite for Navigation Search Component
 * Closes #559
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { NavigationSearch } from '@/components/layout/navigation-search';
import { LayoutDashboard, PlusCircle, Users, ArrowLeftRight, Wallet } from 'lucide-react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

const mockNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, keywords: ['home', 'overview'] },
  { href: '/circles/create', label: 'Create Circle', icon: PlusCircle, keywords: ['new', 'add'] },
  { href: '/circles/join', label: 'Join Circle', icon: Users, keywords: ['participate', 'member'] },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight, keywords: ['history', 'payments'] },
  { href: '/profile', label: 'Profile', icon: Wallet, keywords: ['account', 'settings'] },
];

describe('NavigationSearch Component (Issue #559)', () => {
  it('should render search input at the top of navigation', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');
    expect(searchInput).toBeInTheDocument();
  });

  it('should display all menu items when search is empty', () => {
    render(<NavigationSearch items={mockNavItems} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create Circle')).toBeInTheDocument();
    expect(screen.getByText('Join Circle')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('should filter menu items in real-time as user types', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    // Type "circle"
    fireEvent.change(searchInput, { target: { value: 'circle' } });

    // Should show items with "circle" in the label
    expect(screen.getByText('Create Circle')).toBeInTheDocument();
    expect(screen.getByText('Join Circle')).toBeInTheDocument();

    // Should not show other items
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
  });

  it('should filter by label (case-insensitive)', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    fireEvent.change(searchInput, { target: { value: 'DASHBOARD' } });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Create Circle')).not.toBeInTheDocument();
  });

  it('should filter by href path', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    fireEvent.change(searchInput, { target: { value: 'transactions' } });

    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('should filter by keywords', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    // Search for "home" which is a keyword for Dashboard
    fireEvent.change(searchInput, { target: { value: 'home' } });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Create Circle')).not.toBeInTheDocument();
  });

  it('should show "no results" state when no items match', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search term')).toBeInTheDocument();
  });

  it('should display clear button when search has text', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    // Initially no clear button
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    // Type something
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Clear button should appear
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('should clear search when clear button is clicked', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...') as HTMLInputElement;

    // Type something
    fireEvent.change(searchInput, { target: { value: 'circle' } });
    expect(searchInput.value).toBe('circle');

    // Click clear button
    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    // Search should be cleared
    expect(searchInput.value).toBe('');

    // All items should be visible again
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('should call onNavigate when a menu item is clicked', () => {
    const onNavigate = jest.fn();
    render(<NavigationSearch items={mockNavItems} onNavigate={onNavigate} />);

    const dashboardLink = screen.getByText('Dashboard');
    fireEvent.click(dashboardLink);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('should clear search when a menu item is clicked', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...') as HTMLInputElement;

    // Type something
    fireEvent.change(searchInput, { target: { value: 'dashboard' } });
    expect(searchInput.value).toBe('dashboard');

    // Click a menu item
    const dashboardLink = screen.getByText('Dashboard');
    fireEvent.click(dashboardLink);

    // Search should be cleared
    expect(searchInput.value).toBe('');
  });

  it('should handle empty search query gracefully', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    // Type spaces only
    fireEvent.change(searchInput, { target: { value: '   ' } });

    // Should show all items (spaces are trimmed)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create Circle')).toBeInTheDocument();
  });

  it('should accept custom placeholder text', () => {
    render(<NavigationSearch items={mockNavItems} placeholder="Find a page..." />);

    expect(screen.getByPlaceholderText('Find a page...')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <NavigationSearch items={mockNavItems} className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should highlight active route', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/transactions');

    render(<NavigationSearch items={mockNavItems} />);

    const transactionsLink = screen.getByText('Transactions').closest('a');
    expect(transactionsLink).toHaveClass('bg-accent');
  });

  it('should filter with partial matches', () => {
    render(<NavigationSearch items={mockNavItems} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    // Search for "trans" (partial match for "Transactions")
    fireEvent.change(searchInput, { target: { value: 'trans' } });

    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('should handle items without keywords', () => {
    const itemsWithoutKeywords = [
      { href: '/', label: 'Home', icon: LayoutDashboard },
      { href: '/about', label: 'About', icon: Users },
    ];

    render(<NavigationSearch items={itemsWithoutKeywords} />);

    const searchInput = screen.getByPlaceholderText('Search menu...');

    // Should still filter by label
    fireEvent.change(searchInput, { target: { value: 'home' } });

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('About')).not.toBeInTheDocument();
  });
});
