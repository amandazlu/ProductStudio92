// src/services/googleCalendar.js

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

// Fetch all events for the signed-in user
export async function fetchCalendarEvents(accessToken) {
  const response = await fetch(`${API_BASE_URL}/calendar?accessToken=${accessToken}`);
  if (!response.ok) throw new Error('Failed to fetch events in frontend');
  return await response.json();
}

// Create a new event
export async function createCalendarEvent(accessToken, eventData) {
  const response = await fetch(`${API_BASE_URL}/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, eventData }),
  });
  if (!response.ok) throw new Error('Failed to create event');
  return await response.json();
}

// Update an existing event
export async function updateCalendarEvent(accessToken, eventId, updatedData) {
  const response = await fetch(`${API_BASE_URL}/calendar/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, updatedData }),
  });
  if (!response.ok) throw new Error('Failed to update event');
  return await response.json();
}

// Delete an event
export async function deleteCalendarEvent(accessToken, eventId) {
  const response = await fetch(`${API_BASE_URL}/calendar/${eventId}?accessToken=${accessToken}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete event');
  return true;
}
