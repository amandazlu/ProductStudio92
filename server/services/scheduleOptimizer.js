import OpenAI from 'openai';
import dotenv from 'dotenv';
import { USER_TIMEZONE } from '../config/timezone.js';

dotenv.config();

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 10000,
  maxRetries: 2
});

/**
 * Calculate commute time between two locations using AI estimation
 * In production, this would use Google Maps Distance Matrix API
 */
async function estimateCommuteTime(fromLocation, toLocation, mode = 'driving') {
  if (!fromLocation || !toLocation) return 0;
  
  // Simple case: same location
  if (fromLocation.toLowerCase() === toLocation.toLowerCase()) return 0;
  
  try {
    const prompt = `Estimate travel time between these locations:
From: ${fromLocation}
To: ${toLocation}
Mode: ${mode}

Respond with ONLY a JSON object:
{
  "minutes": <estimated travel time in minutes>,
  "confidence": <0.0-1.0>
}

Consider typical traffic conditions and realistic travel times.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content.trim();
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const result = JSON.parse(cleanedText);
    return result.minutes || 0;
  } catch (error) {
    console.error('Error estimating commute time:', error);
    // Default conservative estimate based on simple heuristics
    return 30; // Default 30 minutes if estimation fails
  }
}

/**
 * Find available time slots in calendar considering existing events
 */
function findAvailableSlots(existingEvents, searchDate, minDuration = 30, workingHours = { start: 8, end: 20 }) {
  const slots = [];
  const date = new Date(searchDate);
  
  // Create time blocks for the day
  const dayStart = new Date(date);
  dayStart.setHours(workingHours.start, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(workingHours.end, 0, 0, 0);
  
  // Get events for this day, sorted by start time
  const dayEvents = existingEvents
    .filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start);
      return eventStart.toDateString() === date.toDateString();
    })
    .sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start);
      const bStart = new Date(b.start.dateTime || b.start);
      return aStart - bStart;
    });
  
  let currentTime = new Date(dayStart);
  
  // Find gaps between events
  for (const event of dayEvents) {
    const eventStart = new Date(event.start.dateTime || event.start);
    const eventEnd = new Date(event.end.dateTime || event.end);
    
    // Check if there's a gap before this event
    const gapMinutes = (eventStart - currentTime) / (1000 * 60);
    if (gapMinutes >= minDuration) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(eventStart),
        duration: gapMinutes,
        location: null
      });
    }
    
    // Move current time to after this event
    currentTime = new Date(Math.max(currentTime, eventEnd));
  }
  
  // Check if there's time after the last event
  const remainingMinutes = (dayEnd - currentTime) / (1000 * 60);
  if (remainingMinutes >= minDuration) {
    slots.push({
      start: new Date(currentTime),
      end: new Date(dayEnd),
      duration: remainingMinutes,
      location: null
    });
  }
  
  return slots;
}

/**
 * Score a time slot based on multiple factors
 */
function scoreTimeSlot(slot, taskPreferences, previousLocation = null, nextLocation = null) {
  let score = 100; // Start with perfect score
  
  const slotHour = slot.start.getHours();
  
  // Priority scoring (0-100)
  const priorityWeight = taskPreferences.priority || 5;
  score += (priorityWeight - 5) * 10; // -50 to +50 based on priority
  
  // Time of day preferences
  if (taskPreferences.preferredTimeOfDay) {
    const preferred = taskPreferences.preferredTimeOfDay;
    if (preferred === 'morning' && slotHour >= 8 && slotHour < 12) score += 20;
    else if (preferred === 'afternoon' && slotHour >= 12 && slotHour < 17) score += 20;
    else if (preferred === 'evening' && slotHour >= 17 && slotHour < 20) score += 20;
    else score -= 10; // Penalty for non-preferred time
  }
  
  // Duration fit (prefer slots that closely match needed duration)
  const durationFit = Math.abs(slot.duration - taskPreferences.duration);
  if (durationFit === 0) score += 15;
  else if (durationFit <= 15) score += 10;
  else if (durationFit <= 30) score += 5;
  else if (durationFit > 60) score -= 10;
  
  // Location-based scoring (minimize commute)
  if (taskPreferences.location) {
    if (previousLocation && previousLocation !== taskPreferences.location) {
      score -= 10; // Penalty for location change
    }
    if (nextLocation && nextLocation !== taskPreferences.location) {
      score -= 10; // Penalty for location change
    }
  }
  
  // Urgency based on due date
  if (taskPreferences.dueDate) {
    const daysUntilDue = Math.ceil((new Date(taskPreferences.dueDate) - slot.start) / (1000 * 60 * 60 * 24));
    if (daysUntilDue < 0) score -= 100; // Massive penalty for past due
    else if (daysUntilDue === 0) score += 30; // Bonus for scheduling today if due today
    else if (daysUntilDue === 1) score += 20; // Bonus for scheduling soon
    else if (daysUntilDue <= 3) score += 10;
  }
  
  return Math.max(0, Math.min(200, score)); // Clamp between 0-200
}

/**
 * Optimize schedule by finding best time slots for new tasks
 */
export async function optimizeSchedule(existingEvents, newTasks, options = {}) {
  try {
    const {
      searchDays = 7,
      workingHours = { start: 8, end: 20 },
      includeWeekends = true,
      minimizeCommute = true
    } = options;
    
    const today = new Date();
    const recommendations = [];
    
    // Process each task
    for (const task of newTasks) {
      const taskDuration = task.duration || 30;
      const bestSlots = [];
      
      // Search across multiple days
      for (let dayOffset = 0; dayOffset < searchDays; dayOffset++) {
        const searchDate = new Date(today);
        searchDate.setDate(today.getDate() + dayOffset);
        
        // Skip weekends if not included
        if (!includeWeekends && (searchDate.getDay() === 0 || searchDate.getDay() === 6)) {
          continue;
        }
        
        // Find available slots for this day
        const availableSlots = findAvailableSlots(existingEvents, searchDate, taskDuration, workingHours);
        
        // Score each slot
        for (const slot of availableSlots) {
          // Get context of surrounding events for location optimization
          let previousLocation = null;
          let nextLocation = null;
          
          if (minimizeCommute && task.location) {
            const beforeEvents = existingEvents.filter(e => {
              const eventEnd = new Date(e.end.dateTime || e.end);
              return eventEnd <= slot.start;
            });
            if (beforeEvents.length > 0) {
              const lastEvent = beforeEvents.sort((a, b) => {
                const aEnd = new Date(a.end.dateTime || a.end);
                const bEnd = new Date(b.end.dateTime || b.end);
                return bEnd - aEnd;
              })[0];
              previousLocation = lastEvent.location;
            }
            
            const afterEvents = existingEvents.filter(e => {
              const eventStart = new Date(e.start.dateTime || e.start);
              return eventStart >= slot.end;
            });
            if (afterEvents.length > 0) {
              const nextEvent = afterEvents.sort((a, b) => {
                const aStart = new Date(a.start.dateTime || a.start);
                const bStart = new Date(b.start.dateTime || b.start);
                return aStart - bStart;
              })[0];
              nextLocation = nextEvent.location;
            }
          }
          
          const score = scoreTimeSlot(slot, task, previousLocation, nextLocation);
          
          bestSlots.push({
            ...slot,
            score,
            date: searchDate.toISOString().split('T')[0],
            previousLocation,
            nextLocation,
            commuteTimeBefore: 0,
            commuteTimeAfter: 0
          });
        }
      }
      
      // Sort by score and take top recommendations
      bestSlots.sort((a, b) => b.score - a.score);
      const topSlots = bestSlots.slice(0, 3);
      
      // Calculate commute times for top slots if location is specified
      if (minimizeCommute && task.location) {
        for (const slot of topSlots) {
          if (slot.previousLocation) {
            slot.commuteTimeBefore = await estimateCommuteTime(
              slot.previousLocation,
              task.location,
              task.travelMode || 'driving'
            );
          }
          if (slot.nextLocation) {
            slot.commuteTimeAfter = await estimateCommuteTime(
              task.location,
              slot.nextLocation,
              task.travelMode || 'driving'
            );
          }
        }
      }
      
      recommendations.push({
        task: task,
        suggestedSlots: topSlots,
        reasoning: generateReasoning(task, topSlots[0])
      });
    }
    
    return {
      success: true,
      recommendations,
      totalTasks: newTasks.length
    };
  } catch (error) {
    console.error('Error optimizing schedule:', error);
    return {
      success: false,
      error: error.message,
      recommendations: []
    };
  }
}

/**
 * Generate human-readable reasoning for why a slot was chosen
 */
function generateReasoning(task, bestSlot) {
  if (!bestSlot) return 'No suitable time slots found';
  
  const reasons = [];
  
  // Time-based reasons
  const hour = bestSlot.start.getHours();
  if (task.preferredTimeOfDay) {
    if ((task.preferredTimeOfDay === 'morning' && hour >= 8 && hour < 12) ||
        (task.preferredTimeOfDay === 'afternoon' && hour >= 12 && hour < 17) ||
        (task.preferredTimeOfDay === 'evening' && hour >= 17 && hour < 20)) {
      reasons.push(`Scheduled during your preferred ${task.preferredTimeOfDay} time`);
    }
  }
  
  // Duration reasons
  if (bestSlot.duration >= task.duration && bestSlot.duration <= task.duration + 30) {
    reasons.push('Perfect fit for available time');
  } else if (bestSlot.duration > task.duration + 30) {
    reasons.push('Provides buffer time');
  }
  
  // Priority reasons
  if (task.priority >= 8) {
    reasons.push('High priority - scheduled as soon as possible');
  }
  
  // Due date reasons
  if (task.dueDate) {
    const daysUntilDue = Math.ceil((new Date(task.dueDate) - bestSlot.start) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 1) {
      reasons.push('Due soon - scheduled urgently');
    } else if (daysUntilDue <= 3) {
      reasons.push('Scheduled before due date');
    }
  }
  
  // Location reasons
  if (task.location) {
    if (bestSlot.commuteTimeBefore === 0 && bestSlot.commuteTimeAfter === 0) {
      reasons.push('Minimal commute time');
    } else if (bestSlot.commuteTimeBefore + bestSlot.commuteTimeAfter < 30) {
      reasons.push('Reasonable commute from nearby events');
    }
  }
  
  if (reasons.length === 0) {
    reasons.push('Best available time slot');
  }
  
  return reasons.join('; ');
}

/**
 * Extract task details from natural language using AI
 */
export async function extractTaskDetails(text, existingEvents = []) {
  try {
    const now = new Date();
    const currentDateTime = now.toLocaleString('en-US', { timeZone: USER_TIMEZONE });
    
    const prompt = `Extract task scheduling details from this text. The user wants to optimize their schedule.

Text: "${text}"
Current date/time: ${currentDateTime} (${USER_TIMEZONE})

Respond with ONLY valid JSON:
{
  "tasks": [
    {
      "summary": "Task title",
      "description": "Details",
      "duration": <minutes>,
      "priority": 1-10 (1=lowest, 10=highest),
      "dueDate": "ISO 8601 date or null",
      "location": "location or null",
      "preferredTimeOfDay": "morning|afternoon|evening|null",
      "isFlexible": true|false,
      "travelMode": "driving|transit|walking|null"
    }
  ]
}

Priority guidelines:
- 9-10: Urgent, time-sensitive (doctor appointments, deadlines)
- 7-8: Important but some flexibility (meetings, errands)
- 4-6: Moderate priority (routine tasks)
- 1-3: Low priority, highly flexible (nice to have)

Duration guidelines:
- Medical appointments: 60-90 minutes
- Errands (groceries, post office): 30-45 minutes
- Meetings: 30-60 minutes (check context)
- Personal tasks: 15-30 minutes default

Preferred time extraction:
- "in the morning" → "morning"
- "afternoon" or "after lunch" → "afternoon"
- "evening" or "after work" → "evening"
- Extract from phrases like "need to", "have to", "want to schedule"

Examples:
- "I need to pick up my prescription by Friday" → priority 8, dueDate Friday
- "Schedule grocery shopping sometime this week" → priority 5, flexible
- "Doctor appointment on Thursday at 2pm" → priority 9, specific time
- "Drop off package at post office" → priority 6, duration 30 mins`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content.trim();
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const result = JSON.parse(cleanedText);
    
    return result.tasks || [];
  } catch (error) {
    console.error('Error extracting task details:', error);
    return [];
  }
}

/**
 * Suggest schedule reorganization for better efficiency
 */
export async function suggestReorganization(events, targetDate = null) {
  try {
    const date = targetDate ? new Date(targetDate) : new Date();
    
    // Get events for the target day
    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start);
      return eventStart.toDateString() === date.toDateString();
    });
    
    if (dayEvents.length === 0) {
      return {
        hasImprovements: false,
        message: 'No events scheduled for this day'
      };
    }
    
    // Analyze for potential improvements
    const improvements = [];
    
    // Check for location clustering opportunities
    const locationGroups = {};
    dayEvents.forEach(event => {
      if (event.location) {
        if (!locationGroups[event.location]) {
          locationGroups[event.location] = [];
        }
        locationGroups[event.location].push(event);
      }
    });
    
    // Find scattered events at same location
    for (const [location, eventsAtLocation] of Object.entries(locationGroups)) {
      if (eventsAtLocation.length >= 2) {
        const times = eventsAtLocation.map(e => new Date(e.start.dateTime || e.start).getHours());
        const timeSpread = Math.max(...times) - Math.min(...times);
        
        if (timeSpread > 4) { // Events spread more than 4 hours apart
          improvements.push({
            type: 'location_clustering',
            location: location,
            eventCount: eventsAtLocation.length,
            suggestion: `Consider grouping ${eventsAtLocation.length} events at ${location} closer together to minimize multiple trips`,
            potentialTimeSaved: timeSpread * 15 // Estimate time savings
          });
        }
      }
    }
    
    // Check for scheduling inefficiencies (long gaps)
    const sortedEvents = dayEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start);
      const bStart = new Date(b.start.dateTime || b.start);
      return aStart - bStart;
    });
    
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEnd = new Date(sortedEvents[i].end.dateTime || sortedEvents[i].end);
      const nextStart = new Date(sortedEvents[i + 1].start.dateTime || sortedEvents[i + 1].start);
      const gapMinutes = (nextStart - currentEnd) / (1000 * 60);
      
      if (gapMinutes > 120) { // Gap longer than 2 hours
        improvements.push({
          type: 'large_gap',
          gap: gapMinutes,
          between: [sortedEvents[i].summary, sortedEvents[i + 1].summary],
          suggestion: `${Math.floor(gapMinutes / 60)} hour gap between events - consider filling with a task or consolidating schedule`
        });
      }
    }
    
    return {
      hasImprovements: improvements.length > 0,
      improvements: improvements,
      totalEvents: dayEvents.length,
      message: improvements.length > 0 
        ? `Found ${improvements.length} optimization opportunity(ies)`
        : 'Schedule looks well optimized'
    };
  } catch (error) {
    console.error('Error suggesting reorganization:', error);
    return {
      hasImprovements: false,
      error: error.message
    };
  }
}
