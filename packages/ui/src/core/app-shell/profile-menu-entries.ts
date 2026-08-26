import { LucideIcon, User, MapPin, Radio, Key, ListChecks, Bell, FileText, ShieldAlert, Archive, Sparkles, Activity, AlertCircle } from 'lucide-react';

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
    id: 'account-settings',
    labelKey: 'accountSettings',
    href: '/settings/account',
    icon: Radio,
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
