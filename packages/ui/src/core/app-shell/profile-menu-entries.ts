import { LucideIcon, User, MapPin, Radio, Key, ListChecks, Bell, FileText, ShieldAlert, Archive, Sparkles } from 'lucide-react';

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
    id: 'subscriptions',
    labelKey: 'subscriptions',
    href: '/settings/subscriptions',
    icon: Radio,
    requiresApiKey: true,
  },
  {
    id: 'manual-post-selection',
    labelKey: 'manualPostSelection',
    href: '/posts/select',
    icon: Sparkles,
  },
  {
    id: 'api-keys',
    labelKey: 'api-keys',
    href: '/settings/api-keys',
    icon: Key,
  },
  {
    id: 'queue-status',
    labelKey: 'queueStatus',
    href: '/settings/queue-status',
    icon: ListChecks,
  },
  {
    id: 'notifications',
    labelKey: 'notifications',
    href: '/settings/notifications',
    icon: Bell,
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
];
