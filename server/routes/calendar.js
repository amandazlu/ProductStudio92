import express from 'express';
import { createEvent } from '../services/calendarService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const eventData = req.body; // e.g. { summary, start, end }
    const result = await createEvent(eventData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Calendar event creation failed' });
  }
});

export default router;
