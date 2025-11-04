// src/services/googleCalendar.js

export const fetchCalendarEvents = async (accessToken) => {
    try {
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
  
      if (!response.ok) throw new Error('Failed to fetch events');
  
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  };
  
  export const createCalendarEvent = async (accessToken, event) => {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );
  
    if (!response.ok) throw new Error('Failed to create event');
    return await response.json();
  };
  
  export const updateCalendarEvent = async (accessToken, eventId, event) => {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );
  
    if (!response.ok) throw new Error('Failed to update event');
    return await response.json();
  };
  
  export const deleteCalendarEvent = async (accessToken, eventId) => {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  
    if (!response.ok) throw new Error('Failed to delete event');
    return true;
  };
  