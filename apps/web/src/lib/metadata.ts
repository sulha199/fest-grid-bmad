import type { Metadata } from 'next';

export interface PageMetadataProps {
  title: string;
  description: string;
}

export function buildPageMetadata({ title, description }: PageMetadataProps): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}
