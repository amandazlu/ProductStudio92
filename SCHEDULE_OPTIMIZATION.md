# Schedule Optimization Feature

## Overview

ClearMind AI now includes intelligent schedule optimization that helps users find the best time slots for their tasks based on:
- **Priority levels** (1-10 scale)
- **Due dates and deadlines**
- **Duration and time preferences**
- **Location and commute times**
- **Existing calendar commitments**

## Features

### 1. Smart Task Extraction
The AI automatically extracts task details from natural language:

```javascript
"I need to pick up my prescription by Friday afternoon"
// Extracts:
// - Task: Pick up prescription
// - Priority: 8 (high - medical-related)
// - Due date: This Friday
// - Preferred time: afternoon
// - Duration: 30 minutes (default for errands)
```

### 2. Priority-Based Scheduling
Tasks are assigned priorities (1-10) that affect time slot scoring:

- **9-10**: Urgent, time-sensitive (doctor appointments, critical deadlines)
- **7-8**: Important with some flexibility (meetings, important errands)
- **4-6**: Moderate priority (routine tasks)
- **1-3**: Low priority, highly flexible (nice to have)

### 3. Location-Aware Optimization
The system considers:
- Location of tasks
- Location of existing events
- Commute time between locations
- Clustering tasks at the same location

### 4. Intelligent Time Slot Scoring
Each potential time slot is scored (0-200) based on:
- Priority weight (±50 points)
- Time of day preference match (+20 points)
- Duration fit (+15 points for perfect match)
- Location optimization (-10 points per location change)
- Due date urgency (up to +30 points)

## API Endpoints

### POST /api/schedule/smart-schedule
Extract tasks from text and find optimal time slots in one call.

**Request:**
```json
{
  "text": "I need to schedule a doctor appointment this week and pick up groceries",
  "existingEvents": [...],
  "options": {
    "searchDays": 7,
    "workingHours": { "start": 8, "end": 20 },
    "includeWeekends": true,
    "minimizeCommute": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "summary": "Doctor appointment",
      "duration": 60,
      "priority": 9,
      "dueDate": "2025-12-13",
      "preferredTimeOfDay": null
    }
  ],
  "recommendations": [
    {
      "task": {...},
      "suggestedSlots": [
        {
          "start": "2025-12-10T14:00:00-05:00",
          "end": "2025-12-10T15:00:00-05:00",
          "score": 165,
          "commuteTimeBefore": 0,
          "commuteTimeAfter": 15
        }
      ],
      "reasoning": "High priority - scheduled as soon as possible; Provides buffer time"
    }
  ]
}
```

### POST /api/schedule/optimize
Optimize schedule for already-extracted tasks.

**Request:**
```json
{
  "tasks": [
    {
      "summary": "Team meeting",
      "duration": 60,
      "priority": 7,
      "location": "Office",
      "preferredTimeOfDay": "morning"
    }
  ],
  "existingEvents": [...],
  "options": {...}
}
```

### POST /api/schedule/extract-tasks
Extract task details from natural language without scheduling.

**Request:**
```json
{
  "text": "Need to schedule dentist appointment and grocery shopping",
  "existingEvents": [...]
}
```

### POST /api/schedule/suggest-reorganization
Analyze existing schedule for efficiency improvements.

**Request:**
```json
{
  "events": [...],
  "targetDate": "2025-12-10"
}
```

**Response:**
```json
{
  "hasImprovements": true,
  "improvements": [
    {
      "type": "location_clustering",
      "location": "Grocery Store",
      "eventCount": 2,
      "suggestion": "Consider grouping 2 events at Grocery Store closer together",
      "potentialTimeSaved": 60
    }
  ]
}
```

### POST /api/schedule/analyze-day
Get detailed analysis of a specific day's schedule.

**Response:**
```json
{
  "date": "2025-12-10",
  "totalEvents": 4,
  "totalScheduledTime": 240,
  "freeTime": 480,
  "efficiency": 33,
  "locationBreakdown": {
    "Office": 2,
    "Home": 2
  },
  "suggestions": {...}
}
```

## Frontend Integration

### Using the Hook

```javascript
import useScheduleOptimization from './hooks/useScheduleOptimization';

function MyComponent() {
  const {
    recommendations,
    isOptimizing,
    optimizationError,
    optimizeFromText,
    clearRecommendations,
    hasSchedulingIntent
  } = useScheduleOptimization(calendarEvents, googleAccessToken);

  const handleMessage = async (text) => {
    // Check if message has scheduling intent
    if (hasSchedulingIntent(text)) {
      // Optimize schedule
      const result = await optimizeFromText(text, {
        searchDays: 7,
        includeWeekends: true
      });
      
      if (result.success) {
        console.log('Found recommendations:', result.recommendations);
      }
    }
  };
}
```

### Using the Component

```javascript
import ScheduleOptimizer from './components/ScheduleOptimizer';

function Chat() {
  const [recommendations, setRecommendations] = useState(null);
  
  const handleAcceptSlot = async (task, slot) => {
    // Create calendar event from the accepted slot
    const eventData = {
      summary: task.summary,
      description: task.description,
      start: slot.start,
      end: slot.end,
      location: task.location
    };
    
    // Add to calendar...
  };
  
  return (
    <>
      {recommendations && (
        <ScheduleOptimizer
          recommendations={recommendations}
          onAcceptSlot={handleAcceptSlot}
          onDismiss={() => setRecommendations(null)}
        />
      )}
    </>
  );
}
```

## Task Structure

### Complete Task Object

```javascript
{
  summary: string,              // Task title (required)
  description: string,           // Additional details
  duration: number,              // Duration in minutes (default: 30)
  priority: number,              // 1-10 scale (default: 5)
  dueDate: string | null,        // ISO date string
  location: string | null,       // Location name
  preferredTimeOfDay: string,    // "morning" | "afternoon" | "evening" | null
  isFlexible: boolean,           // Whether timing is flexible
  travelMode: string             // "driving" | "transit" | "walking"
}
```

## Optimization Options

```javascript
{
  searchDays: number,            // Days ahead to search (default: 7)
  workingHours: {                // Working hours window
    start: number,               // Hour (0-23, default: 8)
    end: number                  // Hour (0-23, default: 20)
  },
  includeWeekends: boolean,      // Include Sat/Sun (default: true)
  minimizeCommute: boolean       // Optimize for location (default: true)
}
```

## Example Use Cases

### 1. High-Priority Urgent Task
```
User: "I need to see the doctor by tomorrow for a follow-up"

AI extracts:
- Priority: 9 (medical + urgent)
- Due: Tomorrow
- Duration: 60 min
- Result: Schedules ASAP in next available slot
```

### 2. Location-Optimized Errands
```
User: "I need to go to the post office, then grocery shopping"

AI extracts:
- Task 1: Post office (30 min)
- Task 2: Grocery shopping (45 min)
- Result: Schedules back-to-back if same area, or considers commute time
```

### 3. Time Preference Matching
```
User: "Schedule my workout for morning and meeting in the afternoon"

AI extracts:
- Workout: preferredTimeOfDay = "morning"
- Meeting: preferredTimeOfDay = "afternoon"
- Result: Higher scores for morning/afternoon slots respectively
```

### 4. Flexible Low-Priority Task
```
User: "At some point this week I should organize my closet"

AI extracts:
- Priority: 3 (low)
- Flexible: true
- Result: Fills available gaps in schedule, doesn't prioritize
```

## How Scoring Works

Each time slot gets a score from 0-200:

1. **Base score**: 100 points
2. **Priority adjustment**: (priority - 5) × 10 = -50 to +50 points
3. **Time preference match**: +20 points if matches preferred time
4. **Duration fit**: +15 points for exact match, scaling down
5. **Location changes**: -10 points per location change
6. **Due date urgency**: Up to +30 points based on deadline proximity

Example high-scoring slot (170 points):
- Priority 9 task: +40 points
- Matches "afternoon" preference: +20 points
- Perfect duration fit: +15 points
- No location changes: 0 penalty
- Due tomorrow: +30 points
- Total: 100 + 40 + 20 + 15 + 30 = 205 (capped at 200)

## Best Practices

1. **Be specific with priorities**: Use the full 1-10 scale
2. **Include locations when relevant**: Helps optimize commute
3. **Set realistic durations**: Allows better slot matching
4. **Use due dates**: Helps AI prioritize urgent tasks
5. **Specify time preferences**: Morning person? Evening person? Tell the AI!

## Error Handling

The system gracefully handles:
- No available time slots → Returns empty recommendations
- API errors → Returns error message
- Invalid task data → Uses sensible defaults
- Commute estimation failures → Assumes 30-minute default

## Future Enhancements

Potential improvements:
- Google Maps API integration for accurate commute times
- Machine learning on user's scheduling patterns
- Recurring task optimization
- Multi-day task scheduling
- Team availability consideration
- Energy level optimization (focus work vs. errands)
