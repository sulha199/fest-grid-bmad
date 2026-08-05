import { LucideIcon, Compass, Rss, Heart, CalendarDays } from 'lucide-react';

export interface NavEntry {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Registry of navigation entries for the AppShell.
 * 
 * Feature stories (Epics 1-5) should append their routes here.
 * The AppShell dynamically renders these in both desktop and mobile navigation.
 */
export const navEntries: NavEntry[] = [
  {
    labelKey: 'discover',
    href: '/',
    icon: Compass,
  },
  {
    labelKey: 'feed',
    href: '/feed',
    icon: Rss,
  },
  {
    labelKey: 'favorites',
    href: '/favorites',
    icon: Heart,
  },
  {
    labelKey: 'calendar',
    href: '/my-calendar',
    icon: CalendarDays,
  },
];
