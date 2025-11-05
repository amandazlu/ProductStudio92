import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import whisperRoutes from './routes/whisper.js';
import calendarRoutes from './routes/calendar.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/whisper', whisperRoutes);
app.use('/api/calendar', calendarRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
