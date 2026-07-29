import { NextResponse } from 'next/server';
import { GraphQLClient } from 'graphql-request';
import type { EventInfo } from '@festgrid/shared-types';

// The GraphQL API is served by the apps/backend AWS Lambda (behind API
// Gateway in production; a local HTTP server during development). This
// route acts as a same-origin proxy so the browser never needs to know
// the backend's URL directly.
const BACKEND_GRAPHQL_URL = process.env.BACKEND_GRAPHQL_URL ?? 'http://localhost:4001/graphql';

const EVENTS_QUERY = `
  query Events($page: Int, $pageSize: Int, $query: EventQueryInput) {
    events(page: $page, pageSize: $pageSize, query: $query) {
      items {
        id
        slug
        isEvent
        eventName
        types
        categories
        location
        organizerName
        description
        schedules {
          id
          slug
          isMainSchedule
          eventStartDate
          eventEndDate
          eventStartTime
          eventEndTime
          title
          performers
          location
          ticketPrice
        }
      }
      hasMore
    }
  }
`;

interface EventsQueryResponse {
  events: { items: EventInfo[]; hasMore: boolean };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '6');
  const rawQuery = searchParams.get('query');

  try {
    const client = new GraphQLClient(BACKEND_GRAPHQL_URL);
    const data = await client.request<EventsQueryResponse>(EVENTS_QUERY, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 6,
      query: rawQuery ? JSON.parse(rawQuery) : undefined,
    });

    return NextResponse.json(data.events);
  } catch (error) {
    console.error('Failed to load events from the backend GraphQL API', error);
    return NextResponse.json({ error: 'Unable to load events.' }, { status: 500 });
  }
}
