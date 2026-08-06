'use client';

import * as React from 'react';
import { LogOut, X } from 'lucide-react';
import { profileMenuEntries } from './profile-menu-entries';

export interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  avatarUrl?: string;
  displayName?: string;
  role?: string;
  onSignOut: () => void;
  renderLink: React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
    onClick?: () => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  }>;
  labels: Record<string, string>;
}

export function UserMenu({
  isOpen,
  onClose,
  triggerRef,
  avatarUrl,
  displayName,
  role,
  onSignOut,
  renderLink: Link,
  labels,
}: UserMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Outside click & escape listeners
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        !(triggerRef.current && triggerRef.current.contains(target))
      ) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleOutsideClick, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleOutsideClick, true);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  // Filter entries based on role
  const visibleEntries = profileMenuEntries.filter((entry) => {
    if (entry.requiresModerator) {
      return role === 'MODERATOR';
    }
    return true;
  });

  const handleKeyDownOnFirstItem = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Tab' && e.shiftKey) {
      onClose();
    }
  };

  const handleKeyDownOnLastItem = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-background/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Menu Container */}
      <div
        ref={menuRef}
        className="fixed inset-x-0 bottom-0 max-h-[80vh] bg-popover text-popover-foreground rounded-t-xl shadow-2xl border-t border-border z-50 flex flex-col md:absolute md:inset-auto md:bottom-14 md:start-16 xl:start-4 xl:bottom-16 md:w-64 md:rounded-lg md:border md:py-2 md:shadow-lg transition-transform duration-200"
      >
        {/* Mobile Header (with Close Button) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border md:hidden">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium">
                {(displayName || 'U')[0].toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm truncate">{displayName || 'User'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close || 'Close menu'}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border mb-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium">
              {(displayName || 'U')[0].toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-sm truncate">{displayName || 'User'}</span>
        </div>

        {/* Links List */}
        <ul className="flex-1 overflow-y-auto px-2 md:px-1 space-y-0.5">
          {visibleEntries.map((entry, index) => {
            const Icon = entry.icon;
            const isFirst = index === 0;
            const isModeratorLink = entry.requiresModerator;

            return (
              <React.Fragment key={entry.id}>
                {/* Leading divider only for Moderator Items */}
                {isModeratorLink && (
                  <li className="my-1 border-t border-border" aria-hidden="true" />
                )}

                <li>
                  <Link
                    href={entry.href || '#'}
                    onClick={onClose}
                    onKeyDown={isFirst ? handleKeyDownOnFirstItem : undefined}
                    className="min-h-11 w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-sm rounded-md transition-colors text-start"
                  >
                    <Icon
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <span>{labels[entry.labelKey] || entry.labelKey}</span>
                  </Link>
                </li>
              </React.Fragment>
            );
          })}

          {/* Trailing divider always before Log Out */}
          <li className="my-1 border-t border-border" aria-hidden="true" />

          {/* Log Out Trigger */}
          <li>
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              onKeyDown={handleKeyDownOnLastItem}
              className="min-h-11 w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-sm text-destructive hover:text-destructive rounded-md transition-colors text-start"
            >
              <LogOut className="h-4 w-4" />
              <span>{labels.logout || 'Log Out'}</span>
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}
