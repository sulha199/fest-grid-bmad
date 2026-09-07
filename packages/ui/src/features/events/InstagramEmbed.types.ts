/**
 * Override labels for InstagramEmbed's internal microcopy.
 * Allows localization (e.g. via next-intl) without coupling the component to a framework,
 * mirroring the `labels` override pattern established by EventImage/EventDetailView (AD-6).
 * All fields are optional and fall back to sensible English defaults.
 */
export interface InstagramEmbedLabels {
  contentNoLongerAvailableLabel?: string;
  embedLoadingLabel?: string;
  embedRegionLabel?: string;
}

/**
 * Props for the InstagramEmbed component.
 *
 * `status`/`html`/`durableImageUrl` mirror the shape of Story 3.7e's `Event.instagramEmbed`
 * resolver field, but are declared locally (decoupled from any generated GraphQL type) per
 * the same precedent EventDetailViewProps/ScheduleDetail already established in Story 1.6a.
 */
export interface InstagramEmbedProps {
  status: 'AVAILABLE' | 'UNAVAILABLE' | null | undefined;
  html?: string | null;
  durableImageUrl?: string | null;
  durableImageAlt?: string | null;
  eventName: string;
  labels?: InstagramEmbedLabels;
}
