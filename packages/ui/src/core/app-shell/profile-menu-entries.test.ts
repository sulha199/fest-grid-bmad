import { describe, expect, it } from 'vitest';
import { ListChecks } from 'lucide-react';
import { profileMenuEntries } from './profile-menu-entries';
import { navEntries } from './nav-entries';

describe('profileMenuEntries: Jobs (Story 10.4)', () => {
  it('has a Jobs entry right after Account Settings, for every signed-in user, with the ListChecks icon', () => {
    const ids = profileMenuEntries.map((e) => e.id);
    expect(ids.indexOf('jobs')).toBe(ids.indexOf('account-settings') + 1);
    const jobs = profileMenuEntries.find((e) => e.id === 'jobs');
    expect(jobs).toMatchObject({ labelKey: 'jobs', href: '/jobs', icon: ListChecks });
    expect(jobs?.requiresModerator).toBeUndefined();
    expect(jobs?.requiresApiKey).toBeUndefined();
  });

  it('adds nothing to the main navigation (the entry lives in the profile menu only)', () => {
    expect(navEntries.some((e) => 'href' in e && String(e.href).includes('/jobs'))).toBe(false);
  });
});
