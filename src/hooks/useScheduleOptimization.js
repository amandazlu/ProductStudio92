import { useState, useCallback } from 'react';
import { smartSchedule, optimizeSchedule } from '../services/scheduleService.js';

export default function useScheduleOptimization(calendarEvents, googleAccessToken) {
  const [recommendations, setRecommendations] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState(null);

  /**
   * Process text to extract tasks and find optimal time slots
   */
  const optimizeFromText = useCallback(async (text, options = {}) => {
    if (!text || !text.trim()) {
      return { success: false, message: 'No text provided' };
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      console.log('Starting schedule optimization from text:', text);
      
      // Convert calendar events to the format expected by the API
      const formattedEvents = calendarEvents.map(event => ({
        summary: event.title || event.summary,
        start: event.start,
        end: event.end,
        location: event.location || null
      }));

      const result = await smartSchedule(text, formattedEvents, {
        searchDays: options.searchDays || 7,
        workingHours: options.workingHours || { start: 8, end: 20 },
        includeWeekends: options.includeWeekends !== undefined ? options.includeWeekends : true,
        minimizeCommute: options.minimizeCommute !== undefined ? options.minimizeCommute : true
      });

      console.log('Optimization result:', result);

      if (result.success && result.recommendations && result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
        return { 
          success: true, 
          recommendations: result.recommendations,
          tasks: result.tasks
        };
      } else {
        const message = result.message || 'No optimal time slots found';
        setOptimizationError(message);
        return { success: false, message };
      }
    } catch (error) {
      console.error('Error optimizing schedule:', error);
      const errorMessage = 'Failed to optimize schedule. Please try again.';
      setOptimizationError(errorMessage);
      return { success: false, message: errorMessage, error };
    } finally {
      setIsOptimizing(false);
    }
  }, [calendarEvents]);

  /**
   * Optimize for specific tasks (already extracted)
   */
  const optimizeFromTasks = useCallback(async (tasks, options = {}) => {
    if (!tasks || tasks.length === 0) {
      return { success: false, message: 'No tasks provided' };
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      console.log('Starting schedule optimization for tasks:', tasks);
      
      const formattedEvents = calendarEvents.map(event => ({
        summary: event.title || event.summary,
        start: event.start,
        end: event.end,
        location: event.location || null
      }));

      const result = await optimizeSchedule(tasks, formattedEvents, {
        searchDays: options.searchDays || 7,
        workingHours: options.workingHours || { start: 8, end: 20 },
        includeWeekends: options.includeWeekends !== undefined ? options.includeWeekends : true,
        minimizeCommute: options.minimizeCommute !== undefined ? options.minimizeCommute : true
      });

      console.log('Optimization result:', result);

      if (result.success && result.recommendations && result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
        return { 
          success: true, 
          recommendations: result.recommendations 
        };
      } else {
        const message = 'No optimal time slots found';
        setOptimizationError(message);
        return { success: false, message };
      }
    } catch (error) {
      console.error('Error optimizing schedule:', error);
      const errorMessage = 'Failed to optimize schedule. Please try again.';
      setOptimizationError(errorMessage);
      return { success: false, message: errorMessage, error };
    } finally {
      setIsOptimizing(false);
    }
  }, [calendarEvents]);

  /**
   * Clear current recommendations
   */
  const clearRecommendations = useCallback(() => {
    setRecommendations(null);
    setOptimizationError(null);
  }, []);

  /**
   * Check if text contains scheduling intent
   */
  const hasSchedulingIntent = useCallback((text) => {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    const schedulingKeywords = [
      'schedule', 'plan', 'book', 'set up', 'arrange',
      'need to', 'have to', 'should', 'want to',
      'appointment', 'meeting', 'reminder',
      'optimize', 'best time', 'when should',
      'fit in', 'squeeze in', 'find time'
    ];

    return schedulingKeywords.some(keyword => lowerText.includes(keyword));
  }, []);

  return {
    recommendations,
    isOptimizing,
    optimizationError,
    optimizeFromText,
    optimizeFromTasks,
    clearRecommendations,
    hasSchedulingIntent
  };
}
