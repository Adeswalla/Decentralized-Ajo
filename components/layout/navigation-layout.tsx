"use client";

import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { MobileBottomNav } from "./mobile-nav";
import { ResponsiveNav } from "./responsive-nav";

interface NavigationLayoutProps {
  children: ReactNode;
  variant?: "default" | "enhanced" | "mobile-bottom";
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
  notifications?: number;
}

export function NavigationLayout({
  children,
  variant = "enhanced",
  user,
  notifications = 0,
}: NavigationLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      {variant === "default" && <Navbar />}
      {variant === "enhanced" && (
        <ResponsiveNav user={user} notifications={notifications} />
      )}
      {variant === "mobile-bottom" && <Navbar />}

      {/* Main Content */}
      <main className={variant === "mobile-bottom" ? "pb-20" : ""}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {variant === "mobile-bottom" && <MobileBottomNav />}
    </div>
  );
}

// Export individual components for flexibility
export { Navbar } from "./navbar";
export { MobileBottomNav, MobileDrawerNav } from "./mobile-nav";
export { ResponsiveNav } from "./responsive-nav";
