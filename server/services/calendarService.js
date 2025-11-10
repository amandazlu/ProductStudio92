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
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: eventData,
  });
  return response.data;
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
