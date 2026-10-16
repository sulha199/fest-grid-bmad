/**
 * Whether a scrape of an account is currently in flight. Extracted from
 * `SocialMediaAccountProfile.isScrapeInProgress` (Story 5.4a, AC8) so that resolver and
 * `Subscription.activityState` share one definition.
 *
 * - no `scrapeTriggeredAt`: false;
 * - triggered longer than `timeoutHours` ago: false (an orphaned job that never reported back);
 * - otherwise in progress while nothing has completed since the trigger, i.e. `lastScrapedAt` is
 *   null or older than `scrapeTriggeredAt`.
 */
export function computeIsScrapeInProgress(
  profile: { scrapeTriggeredAt: Date | null; lastScrapedAt: Date | null },
  timeoutHours: number,
  now: Date = new Date()
): boolean {
  if (profile.scrapeTriggeredAt === null) {
    return false;
  }

  const timeoutBoundary = new Date(now.getTime() - timeoutHours * 60 * 60 * 1000);
  if (profile.scrapeTriggeredAt < timeoutBoundary) {
    return false;
  }

  return profile.lastScrapedAt === null || profile.lastScrapedAt < profile.scrapeTriggeredAt;
}
