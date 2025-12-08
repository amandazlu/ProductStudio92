import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import speechRoutes from './routes/speech.js';
import calendarRoutes from './routes/calendar.js';
import familyGroupsRoutes from './routes/familyGroups.js';
import scheduleRoutes from './routes/schedule.js';
import userSettingsRoutes from './routes/userSettings.js';


dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/speech', speechRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/family-groups', familyGroupsRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/user-settings', userSettingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`ClearMind AI Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});