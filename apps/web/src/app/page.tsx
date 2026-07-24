import type { EventInfo } from '@festgrid/shared-types';
import { EventType, EventCategory } from '@festgrid/shared-types';

const sampleEvent: EventInfo = {
  id: '1',
  slug: 'coachella-2026',
  isEvent: true,
  eventName: 'Coachella 2026',
  types: [EventType.FESTIVAL],
  categories: [EventCategory.MUSIC],
  location: 'Indio, California',
  schedules: [
    {
      id: 'sched-1',
      slug: 'coachella-2026-main',
      isMainSchedule: true,
      eventStartDate: '2026-04-10T12:00:00Z',
      performers: ['Various Artists'],
    }
  ]
};

export default function Home() {
  const mainSchedule = sampleEvent.schedules[0];

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Welcome to FestGrid 🎧</h1>
      <p>Initializing pnpm monorepo successful!</p>
      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Sample Event from @festgrid/shared-types:</h2>
        <p><strong>Name:</strong> {sampleEvent.eventName}</p>
        <p><strong>Location:</strong> {sampleEvent.location}</p>
        <p><strong>Date:</strong> {mainSchedule?.eventStartDate}</p>
        {mainSchedule?.performers && (
          <p><strong>Performers:</strong> {mainSchedule.performers.join(', ')}</p>
        )}
      </div>
    </div>
  );
}
