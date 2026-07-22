import React from 'react';
import type { Event } from '@festgrid/shared-types';

const sampleEvent: Event = {
  id: '1',
  eventName: 'Coachella 2026',
  performers: ['Various Artists'],
  location: 'Indio, California',
  date: '2026-04-10',
};

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Welcome to FestGrid 🎧</h1>
      <p>Initializing pnpm monorepo successful!</p>
      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Sample Event from @festgrid/shared-types:</h2>
        <p><strong>Name:</strong> {sampleEvent.eventName}</p>
        <p><strong>Location:</strong> {sampleEvent.location}</p>
        <p><strong>Date:</strong> {sampleEvent.date}</p>
      </div>
    </div>
  );
}
