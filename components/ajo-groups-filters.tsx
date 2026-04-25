'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';

export default function AjoGroupsFilters({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Updates the URL query parameters dynamically.
   * @param name - The parameter key (e.g., 'sort', 'status')
   * @param value - The parameter value
   */
  const handleFilterChange = useCallback((name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== 'all') {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    // Reset pagination to page 1 when filters change
    params.delete('page');

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <select
        aria-label="Filter by status"
        onChange={(e) => handleFilterChange('status', e.target.value)}
        defaultValue={searchParams.get('status') || 'all'}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="upcoming">Upcoming</option>
      </select>

      <select
        aria-label="Sort groups"
        onChange={(e) => handleFilterChange('sort', e.target.value)}
        defaultValue={searchParams.get('sort') || 'recent'}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="recent">Most Recent</option>
        <option value="highest_pool">Highest Pool First</option>
        <option value="lowest_pool">Lowest Pool First</option>
      </select>
    </div>
  );
}