import { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  fetchCalendarEvents,
  createCalendarEvent
} from '../services/googleCalendar';

const localizer = momentLocalizer(moment);

export default function CalendarView({ googleAccessToken }) {
  const [events, setEvents] = useState([]);

  // ✅ Fetch events from backend
  useEffect(() => {
    const loadEvents = async () => {
      if (!googleAccessToken) return;
      try {
        const data = await fetchCalendarEvents(googleAccessToken);
        console.log("Fetched events from backend:", data);

        const formatted = data.map((e) => ({
          id: e.id,
          title: e.summary || '(No Title)',
          start: new Date(e.start.dateTime || e.start.date),
          end: new Date(e.end.dateTime || e.end.date),
        }));
        console.log("Formatted events:", formatted);

        setEvents(formatted);
      } catch (error) {
        console.error('Failed to fetch calendar events:', error);
      }
    };
    loadEvents();
  }, [googleAccessToken]);

  // ✅ Add event directly to user's Google Calendar
  const handleSelectSlot = async ({ start, end }) => {
    const title = prompt('Event Title:');
    if (!title || !googleAccessToken) return;

    const eventData = {
      summary: title,
      start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
      end: { dateTime: end.toISOString(), timeZone: 'America/New_York' },
    };

    try {
      const createdEvent = await createCalendarEvent(googleAccessToken, eventData);
      setEvents((prev) => [
        ...prev,
        {
          id: createdEvent.id,
          title,
          start: new Date(createdEvent.start.dateTime),
          end: new Date(createdEvent.end.dateTime),
        },
      ]);
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to add event. Check your backend connection.');
    }
  };

  return (
    <div style={{ height: 600, background: 'white', padding: '1rem' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        selectable
        onSelectSlot={handleSelectSlot}
        style={{
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
}
