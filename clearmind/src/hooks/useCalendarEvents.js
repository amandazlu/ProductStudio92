import { useState, useEffect } from 'react';
import { fetchCalendarEvents } from '../services/googleCalendar.js';

export default function useCalendarEvents(googleAccessToken) {
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [recentlyCreatedEvents, setRecentlyCreatedEvents] = useState([]);

  // Fetch events when token is available
  useEffect(() => {
    const loadEvents = async () => {
      if (googleAccessToken) {
        const events = await fetchCalendarEvents(googleAccessToken);
        setCalendarEvents(events || []);
      }
    };
    
    loadEvents();
  }, [googleAccessToken]);

  return {
    calendarEvents,
    setCalendarEvents,
    recentlyCreatedEvents,
    setRecentlyCreatedEvents
  };
}