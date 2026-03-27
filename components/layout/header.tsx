'use client';

import { useState } from 'react';
import { Menu, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { SidebarNav } from './sidebar';

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-4 flex flex-col gap-6">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <CircleDot className="h-5 w-5 text-primary" />
            <span>Stellar Ajo</span>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <span className="font-semibold flex-1">Stellar Ajo</span>
      <ThemeToggle />
    </header>
  );
}
