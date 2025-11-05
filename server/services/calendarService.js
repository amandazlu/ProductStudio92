import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // path to your service account JSON
  scopes: SCOPES,
});

export async function createEvent(eventData) {
  const calendar = google.calendar({ version: 'v3', auth: await auth.getClient() });
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: eventData,
  });
  return response.data;
}
