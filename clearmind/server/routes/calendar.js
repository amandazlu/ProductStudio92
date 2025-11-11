import express from 'express';
import {
  createEvent,
  getEvents,
  deleteEvent,
  updateEvent
} from '../services/calendarService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { accessToken, eventData } = req.body;
  try {
    const result = await createEvent(accessToken, eventData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Calendar event creation failed' });
  }
});

router.get('/', async (req, res) => {
  const accessToken = req.query.accessToken;
  try {
    const events = await getEvents(accessToken);
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch events in backend' });
  }
});

router.delete('/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const accessToken = req.query.accessToken;
  try {
    await deleteEvent(accessToken, eventId);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

router.put('/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const { accessToken, updatedData } = req.body;
  try {
    const result = await updateEvent(accessToken, eventId, updatedData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

export default router;
