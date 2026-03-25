'use client';

import { useEffect } from 'react';
import { CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <CircleDot className="h-12 w-12 text-destructive mb-6" />
      <h1 className="text-2xl font-bold text-foreground mb-3">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/">Go home</a>
        </Button>
      </div>
    </main>
  );
}
