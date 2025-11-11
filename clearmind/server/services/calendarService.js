// server/services/calendarService.js
import { google } from 'googleapis';

// Initialize calendar client using the user's access token
function getCalendarClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

export async function createEvent(accessToken, eventData) {
    const calendar = getCalendarClient(accessToken);
  
    // Ensure start and end are ISO strings
    if (!eventData.start || !eventData.end) {
      throw new Error("Event must have 'start' and 'end' fields");
    }
  
    const event = {
      summary: eventData.summary || '(No Title)',
      description: eventData.description || '',
      start: {
        dateTime: new Date(eventData.start).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(eventData.end).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      location: eventData.location || '',
    };
  
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      console.log("Created event:", response.data);
      return response.data;
    } catch (err) {
      console.error("Error creating Google Calendar event:", err.response?.data || err.message);
      throw err;
    }
  }
  

export async function getEvents(accessToken) {
    const calendar = getCalendarClient(accessToken);
    const now = new Date().toISOString(); // only show future events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now,
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });
    console.log("Fetched events from Google Calendar:", response.data.items);
    return response.data.items;
}

export async function deleteEvent(accessToken, eventId) {
  const calendar = getCalendarClient(accessToken);
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

export async function updateEvent(accessToken, eventId, updatedData) {
  const calendar = getCalendarClient(accessToken);
  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    resource: updatedData,
  });
  return response.data;
}
