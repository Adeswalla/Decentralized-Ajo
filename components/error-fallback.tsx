'use client';

import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-destructive/20 bg-destructive/5">
      <p className="text-sm font-semibold text-destructive mb-1">Failed to load</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-xs">{error.message}</p>
      <Button size="sm" variant="outline" onClick={resetErrorBoundary}>
        Retry
      </Button>
    </div>
  );
}
