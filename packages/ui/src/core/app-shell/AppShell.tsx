'use client';

import * as React from 'react';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { navEntries } from './nav-entries';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // In a real app we'd use a hook to get the current path, but since this is 
  // UI package we just rely on standard HTML logic or let the consumer handle active states.
  // For WCAG 2.1 AA (aria-current="page"), we will need the path.
  // As a compromise, we can just render the links. To fully support aria-current, 
  // we would need a hook from Next.js (usePathname) which couples us to Next.js.
  // Let's add a simple check using window.location.pathname if available, but it won't be SSR friendly.
  // Better yet, we can accept currentPath as an optional prop.
  
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-6 md:gap-8">
            <a href="/" className="flex items-center space-x-2">
              <Logo />
            </a>

            {/* Desktop Nav */}
            <nav aria-label="Main" className="hidden md:flex items-center gap-6">
              {navEntries.map((entry) => (
                <a
                  key={entry.href}
                  href={entry.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {entry.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Mobile Nav Toggle */}
            <button
              className="md:hidden p-2 -me-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open main menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm" 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 start-0 z-50 w-3/4 max-w-sm border-e bg-background p-6 shadow-lg animate-in slide-in-from-left">
            <div className="flex items-center justify-between mb-8">
              <Logo />
              <button
                className="p-2 -me-2 text-muted-foreground hover:text-foreground"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close main menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav aria-label="Main mobile" className="flex flex-col gap-4">
              {navEntries.length === 0 && (
                <span className="text-sm text-muted-foreground">No menu items yet.</span>
              )}
              {navEntries.map((entry) => (
                <a
                  key={entry.href}
                  href={entry.href}
                  className="text-lg font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {entry.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
