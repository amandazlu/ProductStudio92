import express from 'express';
import { 
  optimizeSchedule, 
  extractTaskDetails, 
  suggestReorganization 
} from '../services/scheduleOptimizer.js';
import { getEvents } from '../services/calendarService.js';

const router = express.Router();

/**
 * POST /api/schedule/optimize
 * Find optimal time slots for new tasks based on priorities, locations, and existing calendar
 */
router.post('/optimize', async (req, res) => {
  try {
    const { tasks, existingEvents, options } = req.body;

    console.log('=== SCHEDULE OPTIMIZATION REQUEST ===');
    console.log('Tasks to schedule:', tasks?.length || 0);
    console.log('Existing events:', existingEvents?.length || 0);
    console.log('Options:', options);

    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ 
        error: 'At least one task is required',
        success: false 
      });
    }

    // Validate task structure
    const validatedTasks = tasks.map(task => ({
      summary: task.summary || 'Untitled Task',
      description: task.description || '',
      duration: task.duration || 30,
      priority: Math.min(10, Math.max(1, task.priority || 5)),
      dueDate: task.dueDate || null,
      location: task.location || null,
      preferredTimeOfDay: task.preferredTimeOfDay || null,
      isFlexible: task.isFlexible !== undefined ? task.isFlexible : true,
      travelMode: task.travelMode || 'driving'
    }));

    console.log('Validated tasks:', validatedTasks);

    const result = await optimizeSchedule(
      existingEvents || [],
      validatedTasks,
      options || {}
    );

    console.log('Optimization complete:', {
      success: result.success,
      recommendationCount: result.recommendations?.length || 0
    });
    console.log('=====================================');

    res.json(result);
  } catch (error) {
    console.error('Error optimizing schedule:', error);
    res.status(500).json({ 
      error: 'Failed to optimize schedule',
      message: error.message,
      success: false
    });
  }
});

/**
 * POST /api/schedule/extract-tasks
 * Extract task details from natural language text
 */
router.post('/extract-tasks', async (req, res) => {
  try {
    const { text, existingEvents } = req.body;

    console.log('=== EXTRACT TASKS REQUEST ===');
    console.log('Text:', text);
    console.log('Existing events:', existingEvents?.length || 0);

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        error: 'Text is required',
        tasks: []
      });
    }

    const tasks = await extractTaskDetails(text, existingEvents || []);

    console.log('Extracted tasks:', tasks.length);
    console.log('Tasks:', tasks);
    console.log('============================');

    res.json({ 
      success: true,
      tasks: tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('Error extracting tasks:', error);
    res.status(500).json({ 
      error: 'Failed to extract tasks',
      message: error.message,
      tasks: []
    });
  }
});

/**
 * POST /api/schedule/suggest-reorganization
 * Analyze existing schedule and suggest improvements
 */
router.post('/suggest-reorganization', async (req, res) => {
  try {
    const { events, targetDate } = req.body;

    console.log('=== REORGANIZATION SUGGESTIONS REQUEST ===');
    console.log('Events:', events?.length || 0);
    console.log('Target date:', targetDate);

    if (!events || events.length === 0) {
      return res.json({ 
        hasImprovements: false,
        message: 'No events to analyze',
        improvements: []
      });
    }

    const suggestions = await suggestReorganization(events, targetDate);

    console.log('Suggestions generated:', suggestions.hasImprovements);
    console.log('==========================================');

    res.json(suggestions);
  } catch (error) {
    console.error('Error suggesting reorganization:', error);
    res.status(500).json({ 
      error: 'Failed to generate suggestions',
      message: error.message,
      hasImprovements: false
    });
  }
});

/**
 * POST /api/schedule/smart-schedule
 * Combined endpoint: Extract tasks from text AND find optimal slots
 */
router.post('/smart-schedule', async (req, res) => {
  try {
    const { text, existingEvents, options } = req.body;

    console.log('=== SMART SCHEDULE REQUEST ===');
    console.log('Text:', text);
    console.log('Existing events:', existingEvents?.length || 0);

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        error: 'Text is required',
        success: false
      });
    }

    // Step 1: Extract tasks from natural language
    const tasks = await extractTaskDetails(text, existingEvents || []);

    if (tasks.length === 0) {
      return res.json({
        success: false,
        message: 'No tasks found in the text',
        tasks: [],
        recommendations: []
      });
    }

    // Step 2: Optimize schedule for extracted tasks
    const optimization = await optimizeSchedule(
      existingEvents || [],
      tasks,
      options || {}
    );

    console.log('Smart schedule complete:', {
      tasksExtracted: tasks.length,
      recommendationsGenerated: optimization.recommendations?.length || 0
    });
    console.log('==============================');

    res.json({
      success: optimization.success,
      tasks: tasks,
      recommendations: optimization.recommendations,
      totalTasks: tasks.length
    });
  } catch (error) {
    console.error('Error in smart schedule:', error);
    res.status(500).json({ 
      error: 'Failed to process smart schedule',
      message: error.message,
      success: false
    });
  }
});

/**
 * GET /api/schedule/analyze-day
 * Analyze a specific day's schedule for efficiency
 */
router.post('/analyze-day', async (req, res) => {
  try {
    const { events, date } = req.body;

    console.log('=== ANALYZE DAY REQUEST ===');
    console.log('Date:', date);
    console.log('Events:', events?.length || 0);

    if (!events || events.length === 0) {
      return res.json({
        date: date,
        totalEvents: 0,
        totalScheduledTime: 0,
        freeTime: 0,
        analysis: 'No events scheduled for this day'
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    
    // Filter events for this specific day
    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start);
      return eventStart.toDateString() === targetDate.toDateString();
    });

    if (dayEvents.length === 0) {
      return res.json({
        date: targetDate.toISOString().split('T')[0],
        totalEvents: 0,
        totalScheduledTime: 0,
        freeTime: 720, // 12 hours (8am-8pm)
        analysis: 'No events scheduled for this day'
      });
    }

    // Calculate metrics
    let totalScheduledMinutes = 0;
    const eventsByLocation = {};
    
    dayEvents.forEach(event => {
      const start = new Date(event.start.dateTime || event.start);
      const end = new Date(event.end.dateTime || event.end);
      const duration = (end - start) / (1000 * 60);
      totalScheduledMinutes += duration;
      
      if (event.location) {
        eventsByLocation[event.location] = (eventsByLocation[event.location] || 0) + 1;
      }
    });

    // Get reorganization suggestions
    const suggestions = await suggestReorganization(events, targetDate);

    console.log('Day analysis complete');
    console.log('==========================');

    res.json({
      date: targetDate.toISOString().split('T')[0],
      totalEvents: dayEvents.length,
      totalScheduledTime: totalScheduledMinutes,
      freeTime: 720 - totalScheduledMinutes, // Assuming 12-hour workday
      locationBreakdown: eventsByLocation,
      suggestions: suggestions,
      efficiency: totalScheduledMinutes > 0 
        ? Math.round((totalScheduledMinutes / 720) * 100)
        : 0
    });
  } catch (error) {
    console.error('Error analyzing day:', error);
    res.status(500).json({ 
      error: 'Failed to analyze day',
      message: error.message
    });
  }
});

export default router;
