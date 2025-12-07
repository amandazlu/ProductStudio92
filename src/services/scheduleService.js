const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

/**
 * Extract tasks from natural language and optimize schedule
 */
export async function smartSchedule(text, existingEvents, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/schedule/smart-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        existingEvents,
        options
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in smart schedule:', error);
    throw error;
  }
}

/**
 * Optimize schedule for specific tasks
 */
export async function optimizeSchedule(tasks, existingEvents, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedule/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks,
        existingEvents,
        options
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error optimizing schedule:', error);
    throw error;
  }
}

/**
 * Extract task details from text
 */
export async function extractTasks(text, existingEvents = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedule/extract-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        existingEvents
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error extracting tasks:', error);
    throw error;
  }
}

/**
 * Get reorganization suggestions for existing schedule
 */
export async function getReorganizationSuggestions(events, targetDate = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedule/suggest-reorganization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events,
        targetDate
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting reorganization suggestions:', error);
    throw error;
  }
}

/**
 * Analyze a specific day's schedule
 */
export async function analyzeDaySchedule(events, date = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedule/analyze-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events,
        date
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing day schedule:', error);
    throw error;
  }
}

/**
 * Format a time slot for display
 */
export function formatTimeSlot(slot) {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  
  const dateStr = start.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
  
  const timeStr = `${start.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  })} - ${end.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  })}`;
  
  return `${dateStr} at ${timeStr}`;
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get priority label and color
 */
export function getPriorityInfo(priority) {
  if (priority >= 9) {
    return { label: 'Urgent', color: 'red', emoji: '🔴' };
  } else if (priority >= 7) {
    return { label: 'High', color: 'orange', emoji: '🟠' };
  } else if (priority >= 4) {
    return { label: 'Medium', color: 'yellow', emoji: '🟡' };
  } else {
    return { label: 'Low', color: 'green', emoji: '🟢' };
  }
}
