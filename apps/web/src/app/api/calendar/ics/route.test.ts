import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { graphqlClient } from '@/lib/graphql-client';

// Mock graphql client
vi.mock('@/lib/graphql-client', () => ({
  graphqlClient: {
    request: vi.fn()
  }
}));

describe('ICS Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if eventId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/calendar/ics');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('eventId is required');
  });

  it('returns 404 if event is not found', async () => {
    vi.mocked(graphqlClient.request).mockResolvedValueOnce({ event: null });

    const req = new NextRequest('http://localhost:3000/api/calendar/ics?eventId=evt-1');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Event not found');
  });

  it('returns 404 if no matching schedules found', async () => {
    vi.mocked(graphqlClient.request).mockResolvedValueOnce({
      event: {
        id: 'evt-1',
        eventName: 'Test',
        slug: 'test',
        schedules: [
          { id: 'sched-1' }
        ]
      }
    });

    const req = new NextRequest('http://localhost:3000/api/calendar/ics?eventId=evt-1&scheduleId=sched-99');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('No matching schedules found');
  });

  it('returns 200 with all schedules if scheduleId is omitted', async () => {
    vi.mocked(graphqlClient.request).mockResolvedValueOnce({
      event: {
        id: 'evt-1',
        eventName: 'Test Event',
        slug: 'test-event',
        schedules: [
          {
            id: 'sched-1',
            eventStartDate: '2026-08-10',
          },
          {
            id: 'sched-2',
            eventStartDate: '2026-08-11',
          }
        ]
      }
    });

    const req = new NextRequest('http://localhost:3000/api/calendar/ics?eventId=evt-1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="test-event.ics"');

    const text = await res.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('UID:sched-1@festdaily.app');
    expect(text).toContain('UID:sched-2@festdaily.app');
  });

  it('returns 200 with specific multiple schedules if requested', async () => {
    vi.mocked(graphqlClient.request).mockResolvedValueOnce({
      event: {
        id: 'evt-1',
        eventName: 'Test Event',
        slug: 'test-event',
        schedules: [
          { id: 'sched-1', eventStartDate: '2026-08-10' },
          { id: 'sched-2', eventStartDate: '2026-08-11' },
          { id: 'sched-3', eventStartDate: '2026-08-12' }
        ]
      }
    });

    const req = new NextRequest('http://localhost:3000/api/calendar/ics?eventId=evt-1&scheduleId=sched-1&scheduleId=sched-3');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('UID:sched-1@festdaily.app');
    expect(text).toContain('UID:sched-3@festdaily.app');
    expect(text).not.toContain('UID:sched-2@festdaily.app');
  });
  
  it('returns 500 on unexpected error', async () => {
    vi.mocked(graphqlClient.request).mockRejectedValueOnce(new Error('DB Error'));

    const req = new NextRequest('http://localhost:3000/api/calendar/ics?eventId=evt-1');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal Server Error');
  });
});