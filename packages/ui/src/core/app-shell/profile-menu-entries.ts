import { LucideIcon, User, MapPin, Radio, FileText, ShieldAlert, Archive, Sparkles, Activity, Puzzle, ListChecks } from 'lucide-react';

export interface ProfileMenuEntry {
  id: string;
  labelKey: string; // e.g. 'profile', 'locations', 'subscriptions', 'apiKeys', 'notifications', 'reports', 'moderatorItems', 'logout'
  href?: string;     // Nullable for buttons like 'Log Out'
  icon: LucideIcon;
  requiresModerator?: boolean;
  requiresApiKey?: boolean;
}

export const profileMenuEntries: ProfileMenuEntry[] = [
  {
    id: 'profile',
    labelKey: 'profile',
    href: '/settings',
    icon: User,
  },
  {
    id: 'locations',
    labelKey: 'locations',
    href: '/settings/locations',
    icon: MapPin,
  },
  {
    id: 'ai-filters',
    labelKey: 'aiFilters',
    href: '/settings/ai-filters',
    icon: Sparkles,
  },
  {
    id: 'account-settings',
    labelKey: 'accountSettings',
    href: '/settings/account',
    icon: Radio,
  },
  {
    // Story 10.4 (Jobs page): after Account Settings, not a sixth main-navigation item. The finished-since-last-visit
    // badge is Story 10.13's (notify when a job finishes), not wired here.
    id: 'jobs',
    labelKey: 'jobs',
    href: '/jobs',
    icon: ListChecks,
  },
  {
    id: 'manual-post-selection',
    labelKey: 'manualPostSelection',
    href: '/posts/select',
    icon: Sparkles,
  },
  {
    id: 'reports',
    labelKey: 'reports',
    href: '/reports',
    icon: FileText,
  },
  {
    id: 'archive',
    labelKey: 'archive',
    href: '/archive',
    icon: Archive,
  },
  {
    id: 'widgets',
    labelKey: 'widgets',
    href: '/settings/widgets',
    icon: Puzzle,
  },
  {
    id: 'moderator-items',
    labelKey: 'moderatorItems',
    href: '/moderator/items',
    icon: ShieldAlert,
    requiresModerator: true,
  },
  {
    id: 'moderator-tools',
    labelKey: 'moderatorTools',
    href: '/moderator/tools',
    icon: Activity,
    requiresModerator: true,
  },
];
