/**
 * Navigation Search Component
 * Closes #559
 * 
 * Provides real-time search filtering for navigation menu items
 */

'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[]; // Additional search keywords
}

interface NavigationSearchProps {
  items: NavigationItem[];
  onNavigate?: () => void;
  placeholder?: string;
  className?: string;
}

export function NavigationSearch({
  items,
  onNavigate,
  placeholder = 'Search menu...',
  className,
}: NavigationSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();

  // Filter menu items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }

    const query = searchQuery.toLowerCase().trim();

    return items.filter((item) => {
      // Search in label
      if (item.label.toLowerCase().includes(query)) {
        return true;
      }

      // Search in href
      if (item.href.toLowerCase().includes(query)) {
        return true;
      }

      // Search in keywords if provided
      if (item.keywords && item.keywords.some((keyword) => keyword.toLowerCase().includes(query))) {
        return true;
      }

      return false;
    });
  }, [items, searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleItemClick = () => {
    setSearchQuery('');
    onNavigate?.();
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Search navigation menu"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtered Navigation Items */}
      <nav className="flex flex-col gap-1">
        {filteredItems.length > 0 ? (
          filteredItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={handleItemClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                pathname === href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No results found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Try a different search term
            </p>
          </div>
        )}
      </nav>
    </div>
  );
}
