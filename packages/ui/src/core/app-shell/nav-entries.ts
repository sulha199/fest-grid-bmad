import { LucideIcon } from 'lucide-react';

export interface NavEntry {
  label: string;
  href: string;
  icon?: LucideIcon;
}

/**
 * Registry of navigation entries for the AppShell.
 * 
 * Feature stories (Epics 1-5) should append their routes here.
 * The AppShell dynamically renders these in both desktop and mobile navigation.
 */
export const navEntries: NavEntry[] = [
  // Placeholder for feature routes
];
