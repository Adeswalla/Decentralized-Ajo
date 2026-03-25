import Link from 'next/link';
import { CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <CircleDot className="h-12 w-12 text-primary mb-6" />
      <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
      <h2 className="text-2xl font-semibold text-foreground mb-3">Page not found</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        This page doesn't exist or may have been moved.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
