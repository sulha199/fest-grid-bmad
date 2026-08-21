export interface FcmPayload {
  tokens: string[];
  notification: {
    title: string;
    body: string;
  };
  data: {
    eventId: string;
    slug: string;
    type: string;
  };
}

export function buildFcmPayload(
  event: { id: string; slug: string; name: string; description: string | null | undefined },
  tokens: string[]
): FcmPayload {
  const desc = event.description || '';
  const truncatedDescription = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;

  return {
    tokens,
    notification: {
      title: event.name,
      body: truncatedDescription,
    },
    data: {
      eventId: event.id,
      slug: event.slug,
      type: 'NEW_EVENT',
    },
  };
}
