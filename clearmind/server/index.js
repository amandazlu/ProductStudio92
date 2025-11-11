import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import whisperRoutes from './routes/whisper.js';
import calendarRoutes from './routes/calendar.js';
import speechRoutes from './routes/speech.js';
import { speech } from 'googleapis/build/src/apis/speech/index.js';

dotenv.config();

const app = express();

app.use(cors({
    origin: 'http://localhost:3000', // allow your React app
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
app.use(express.json());

// DEBUG: log every incoming request
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/api/calendar', calendarRoutes);
app.use('/api/processSpeech', speechRoutes);
// app.use('/api/whisper', whisperRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Nothing after this
