"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDot, Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { NetworkIndicator } from "@/components/wallet/network-indicator";
import { NetworkMismatchModal } from "@/components/wallet/network-mismatch-modal";
import { ThemeSelector } from "@/components/theme-selector";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navLinks } from "./sidebar";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Group navigation links for better organization
  const primaryLinks = navLinks.slice(0, 3);
  const secondaryLinks = navLinks.slice(3);

  return (
    <>
      <nav
        className={cn(
          "sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200",
          isScrolled && "shadow-sm",
        )}
      >
        {/* Desktop & Mobile top bar */}
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6 max-w-7xl mx-auto">
          {/* Branding */}
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg shrink-0 hover:opacity-80 transition-opacity"
          >
            <CircleDot className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">Stellar Ajo</span>
            <span className="sm:hidden">Ajo</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1 flex-1">
            {/* Primary navigation */}
            <ul className="flex items-center gap-1" role="list">
              {primaryLinks.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:scale-105",
                      pathname === href
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Secondary navigation in dropdown */}
            {secondaryLinks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-accent-foreground"
                  >
                    More
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {secondaryLinks.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2 w-full",
                          pathname === href &&
                            "bg-accent text-accent-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Medium screen navigation */}
          <div className="hidden md:flex lg:hidden items-center gap-1 flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-1 text-sm font-medium"
                >
                  Navigation
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} asChild>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-2 w-full",
                        pathname === href && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
            <ThemeSelector />
            <div className="hidden sm:flex items-center gap-2">
              <NetworkIndicator />
              <WalletButton />
            </div>

            {/* Hamburger — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden relative"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              onClick={() => setIsOpen((prev) => !prev)}
            >
              <div className="relative w-5 h-5">
                <Menu
                  className={cn(
                    "absolute inset-0 h-5 w-5 transition-all duration-200",
                    isOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100",
                  )}
                />
                <X
                  className={cn(
                    "absolute inset-0 h-5 w-5 transition-all duration-200",
                    isOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0",
                  )}
                />
              </div>
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t",
            isOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div id="mobile-menu" className="bg-background px-4 pb-6">
            {/* Navigation Links */}
            <ul className="flex flex-col gap-1 pt-4" role="list">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95",
                      pathname === href
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Mobile Wallet Button */}
            <div className="mt-6 pt-4 border-t sm:hidden flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Network</span>
                <NetworkIndicator />
              </div>
              <WalletButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <NetworkMismatchModal />
    </>
  );
}
