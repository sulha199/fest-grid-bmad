import { NextRequest, NextResponse } from 'next/server';
import { graphqlClient } from '@/lib/graphql-client';
import { GetEventForIcsExportDocument, GetEventForIcsExportQuery } from '@/generated/graphql';
import { buildIcsCalendar, IcsEventInput, IcsScheduleInput } from '@/lib/calendar/buildIcsCalendar';

export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const scheduleIds = req.nextUrl.searchParams.getAll('scheduleId');

    const result = await graphqlClient.request<GetEventForIcsExportQuery>(GetEventForIcsExportDocument, { id: eventId });
    const event = result.event;

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let schedulesToInclude = event.schedules;

    if (scheduleIds && scheduleIds.length > 0) {
      schedulesToInclude = event.schedules.filter(s => scheduleIds.includes(s.id));
      if (schedulesToInclude.length === 0) {
        return NextResponse.json({ error: 'No matching schedules found' }, { status: 404 });
      }
    }

    const eventInput: IcsEventInput = {
      eventName: event.eventName,
      slug: event.slug,
      description: event.description,
      location: event.location,
      url: `${req.nextUrl.origin}/events/${event.slug}`
    };

    const scheduleInputs: IcsScheduleInput[] = schedulesToInclude.map(s => ({
      id: s.id,
      eventStartDate: s.eventStartDate,
      eventEndDate: s.eventEndDate,
      eventStartTime: s.eventStartTime,
      eventEndTime: s.eventEndTime,
      timezone: s.timezone,
      location: s.location,
      locationDetails: s.locationDetails ? {
        formattedAddress: s.locationDetails.formattedAddress
      } : null
    }));

    const icsString = buildIcsCalendar(eventInput, scheduleInputs);

    return new NextResponse(icsString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      },
    });
  } catch (error) {
    console.error('ICS Route Handler Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}