const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const USER_TIMEZONE = 'America/New_York'; // Should match backend

/**
 * Get current date in user's timezone (not UTC)
 */
function getCurrentDateInTimezone() {
  const now = new Date();
  // Get date string in user's timezone
  const dateStr = now.toLocaleDateString('en-US', { 
    timeZone: USER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dateStr; // Returns "MM/DD/YYYY"
}

/**
 * Check if a date is "today" in user's timezone
 */
function isToday(dateStr) {
  const today = getCurrentDateInTimezone();
  const eventDate = new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: USER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return today === eventDate;
}

/**
 * Check if a date is "tomorrow" in user's timezone
 */
function isTomorrow(dateStr) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const tomorrowStr = tomorrow.toLocaleDateString('en-US', {
    timeZone: USER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const eventDate = new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: USER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return tomorrowStr === eventDate;
}

export async function fetchCalendarEvents(accessToken) {
  try {
    // Get events starting from beginning of today (midnight)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeMin = todayStart.toISOString();
    
    console.log('=== Fetching Google Calendar Events ===');
    console.log('Current time (UTC):', now.toISOString());
    console.log('Current time (local):', now.toLocaleString('en-US', { timeZone: USER_TIMEZONE }));
    console.log('Fetching from (midnight today):', timeMin);
    console.log('Current date in timezone:', getCurrentDateInTimezone());
    
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?maxResults=100&orderBy=startTime&singleEvents=true&timeMin=${timeMin}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('Total events from Google:', data.items?.length || 0);
    
    const events = data.items?.map(event => {
      // Use dateTime if available, otherwise use date (all-day events)
      const startDateTime = event.start.dateTime || event.start.date;
      const endDateTime = event.end.dateTime || event.end.date;
      
      const eventDate = new Date(startDateTime);
      const eventDateLocal = eventDate.toLocaleString('en-US', { timeZone: USER_TIMEZONE });
      
      let dayLabel = '';
      if (isToday(startDateTime)) {
        dayLabel = ' (TODAY)';
      } else if (isTomorrow(startDateTime)) {
        dayLabel = ' (TOMORROW)';
      }
      
      console.log(`  "${event.summary}"`);
      console.log(`    ISO: ${startDateTime}`);
      console.log(`    Local: ${eventDateLocal}${dayLabel}`);
      
      return {
        id: event.id,
        title: event.summary,
        description: event.description || '',
        start: startDateTime, // Keep as ISO string with timezone
        end: endDateTime,
        location: event.location || '',
      };
    }) || [];
    
    console.log('Transformed events:', events.length);
    console.log('=======================================');
    
    return events;

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

export async function createCalendarEvent(accessToken, eventData) {
  try {
    const event = {
      summary: eventData.summary,
      description: eventData.description || '',
      start: {
        dateTime: eventData.start,
        timeZone: USER_TIMEZONE,
      },
      end: {
        dateTime: eventData.end,
        timeZone: USER_TIMEZONE,
      },
    };

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

export async function updateCalendarEvent(accessToken, eventId, eventData) {
  try {
    const event = {
      summary: eventData.summary,
      description: eventData.description || '',
      start: {
        dateTime: eventData.start,
        timeZone: USER_TIMEZONE,
      },
      end: {
        dateTime: eventData.end,
        timeZone: USER_TIMEZONE,
      },
    };

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update event: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
}

export async function deleteCalendarEvent(accessToken, eventId) {
  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete event: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
}

/**
 * Check if user wants to update an event
 */
export async function checkUpdateIntent(text, recentEvents, allEvents) {
  try {
    const response = await fetch(`${API_BASE_URL}/calendar/check-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, recentEvents, allEvents }),
    });

    if (!response.ok) {
      throw new Error('Failed to check update intent');
    }

    return response.json();
  } catch (error) {
    console.error('Error checking update intent:', error);
    return {
      isUpdateRequest: false,
      eventToUpdate: '',
      confidence: 0
    };
  }
}