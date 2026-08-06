'use client';

import * as React from 'react';
import { ReactNode, ComponentType } from 'react';
import { LogIn, UserCircle } from 'lucide-react';
import { Logo } from './Logo';
import { navEntries } from './nav-entries';
import { NavRailItem } from './NavRailItem';

export type NavKey = 'discover' | 'feed' | 'favorites' | 'calendar' | 'login';

import { UserMenu } from './UserMenu';

export interface AppShellProps {
  children: ReactNode;
  isAuthenticated: boolean;
  avatarUrl?: string;
  displayName?: string;
  onProfileTriggerActivate?: () => void;
  currentPath: string;
  renderLink: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
    'aria-label'?: string;
    'aria-current'?: 'page';
  }>;
  labels: Record<NavKey, string>;
  role?: string;
  onSignOut?: () => void;
  userMenuLabels?: Record<string, string>;
}

export function AppShell({
  children,
  isAuthenticated,
  avatarUrl,
  displayName,
  onProfileTriggerActivate,
  currentPath,
  renderLink,
  labels,
  role,
  onSignOut,
  userMenuLabels,
}: AppShellProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTrigger, setActiveTrigger] = React.useState<'mobile' | 'desktop' | null>(null);

  const mobileTriggerRef = React.useRef<HTMLButtonElement>(null);
  const desktopTriggerRef = React.useRef<HTMLButtonElement>(null);

  const toggleMenu = (triggerType: 'mobile' | 'desktop') => {
    setIsOpen((prev) => !prev);
    setActiveTrigger(triggerType);
    onProfileTriggerActivate?.();
  };

  // Determine Profile icon
  const profileIcon = isAuthenticated && avatarUrl ? (
    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
  ) : isAuthenticated ? (
    <UserCircle className="h-5 w-5" />
  ) : (
    <LogIn className="h-5 w-5" />
  );

  // Determine Profile label
  const profileLabel = isAuthenticated ? (displayName || 'User') : labels.login;

  // Render the Profile NavRailItem
  const renderProfileItem = (triggerType: 'mobile' | 'desktop', className?: string) => {
    if (!isAuthenticated) {
      return (
        <NavRailItem
          variant="link"
          href="/login"
          icon={profileIcon}
          label={profileLabel}
          currentPath={currentPath}
          renderLink={renderLink}
          className={className}
        />
      );
    }

    return (
      <NavRailItem
        variant="trigger"
        icon={profileIcon}
        label={profileLabel}
        onActivate={() => toggleMenu(triggerType)}
        ariaExpanded={isOpen && activeTrigger === triggerType}
        buttonRef={triggerType === 'mobile' ? mobileTriggerRef : desktopTriggerRef}
        className={className}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* 
        Single, persistent navigation landmark landmark. 
        Contains both mobile bottom bar and desktop sidenav rail. 
      */}
      <nav aria-label="Main">
        {/* Mobile Bottom Tab Bar (< 768px) */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-background md:hidden py-1 h-14 [&_a]:flex-col [&_button]:flex-col [&_a]:gap-0.5 [&_button]:gap-0.5 [&_a_span.hidden]:inline [&_button_span.hidden]:inline [&_a_span.hidden]:text-[10px] [&_button_span.hidden]:text-[10px] [&_a]:h-full [&_button]:h-full [&_a]:w-full [&_button]:w-full [&_a]:justify-center [&_button]:justify-center">
          {navEntries.map((entry) => {
            const IconComponent = entry.icon;
            return (
              <NavRailItem
                key={entry.href}
                variant="link"
                href={entry.href}
                icon={<IconComponent className="h-5 w-5" />}
                label={labels[entry.labelKey as NavKey] || entry.labelKey}
                currentPath={currentPath}
                renderLink={renderLink}
              />
            );
          })}
          {renderProfileItem('mobile')}
        </div>

        {/* Sidenav Rail (Tablet md:flex 768-1279px, Desktop xl:flex >= 1280px) */}
        <div className="fixed inset-y-0 start-0 z-40 hidden md:flex md:flex-col md:items-center xl:items-stretch w-16 xl:w-56 border-e bg-background py-4 gap-6">
          {/* Logo (Top pinned) */}
          <div className="flex h-12 items-center justify-center xl:justify-start px-4">
            <Logo />
          </div>

          {/* Links (Middle) */}
          <div className="flex flex-col items-center xl:items-stretch gap-1">
            {navEntries.map((entry) => {
              const IconComponent = entry.icon;
              return (
                <NavRailItem
                  key={entry.href}
                  variant="link"
                  href={entry.href}
                  icon={<IconComponent className="h-5 w-5" />}
                  label={labels[entry.labelKey as NavKey] || entry.labelKey}
                  currentPath={currentPath}
                  renderLink={renderLink}
                />
              );
            })}
          </div>

          {/* Profile (Bottom pinned) */}
          <div className="mt-auto flex flex-col items-center xl:items-stretch relative">
            {renderProfileItem('desktop')}
            <UserMenu
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              triggerRef={activeTrigger === 'mobile' ? mobileTriggerRef : desktopTriggerRef}
              avatarUrl={avatarUrl}
              displayName={displayName}
              role={role}
              onSignOut={onSignOut || (() => {})}
              renderLink={renderLink}
              labels={userMenuLabels || {}}
            />
          </div>
        </div>
      </nav>

      {/* Main Content Area with logical RTL-ready layout spacing */}
      <main className="flex-1 flex flex-col md:ps-16 xl:ps-56 pb-14 md:pb-0">
        {children}
      </main>
    </div>
  );
}
