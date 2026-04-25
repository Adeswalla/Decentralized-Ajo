# Dashboard Skeleton Components

This directory contains skeleton loader components that prevent layout shifts and improve perceived performance during data loading.

## Components

### 1. `DashboardSkeleton`
Main dashboard overview skeleton that shows the complete dashboard structure while loading.

**Usage:**
```tsx
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

// In your component
{loading ? <DashboardSkeleton /> : <Dashboard />}
```

### 2. `CircleListSkeleton`
Skeleton for the circle list grid showing multiple circle cards.

**Usage:**
```tsx
import { CircleListSkeleton } from '@/components/dashboard/circle-list-skeleton';

// Already integrated in CircleList component
{loading ? <CircleListSkeleton /> : <CircleGrid />}
```

### 3. `DashboardStatsSkeleton`
Skeleton for the 4-column stats cards showing metrics like active circles, total members, etc.

**Usage:**
```tsx
import { DashboardStatsSkeleton } from '@/components/dashboard/stats-skeleton';

// In your component
{loading ? <DashboardStatsSkeleton /> : <DashboardStats />}
```

### 4. `UpcomingCyclesSkeleton`
Skeleton for the upcoming cycles sidebar component.

**Usage:**
```tsx
import { UpcomingCyclesSkeleton } from '@/components/dashboard/upcoming-cycles-skeleton';

// In your component
{loading ? <UpcomingCyclesSkeleton /> : <UpcomingCycles />}
```

### 5. `DashboardCardSkeleton`
Individual card skeleton for Ajo group cards (already existed).

**Usage:**
```tsx
import { DashboardCardSkeleton } from '@/components/dashboard-card-skeleton';

// For multiple cards
{loading ? (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {[1,2,3].map(i => <DashboardCardSkeleton key={i} />)}
  </div>
) : <Cards />}
```

## Design Principles

1. **Consistent Sizing**: Skeletons match the actual component dimensions
2. **Proper Animation**: Uses `animate-pulse` for smooth loading indication
3. **Dark Mode Support**: Uses theme-aware colors (`bg-gray-200 dark:bg-gray-700`)
4. **Responsive Design**: Maintains responsive grid layouts
5. **Semantic Structure**: Preserves the same HTML structure as real components

## Integration

The skeleton components are automatically integrated into their respective parent components:

- `Dashboard` component uses `DashboardSkeleton`
- `CircleList` component uses `CircleListSkeleton`  
- `DashboardStats` component has built-in skeleton logic
- Dashboard page uses `DashboardStatsSkeleton` for stats section

## Performance Benefits

- **Prevents Layout Shift**: Maintains consistent layout during loading
- **Improved Perceived Performance**: Users see structure immediately
- **Better UX**: Reduces jarring content jumps
- **Accessibility**: Screen readers can understand loading states