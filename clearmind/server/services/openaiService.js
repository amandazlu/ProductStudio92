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
 * OPTIMIZED: Combined intent analysis and event extraction in ONE API call
 */
export async function analyzeAndExtractEvents(text) {
  try {
    const now = new Date();
    
    // Create timezone-aware date strings
    const todayInEastern = now.toLocaleDateString('en-US', { 
      timeZone: USER_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Calculate tomorrow in Eastern timezone
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowInEastern = tomorrowDate.toLocaleDateString('en-US', { 
      timeZone: USER_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Convert to YYYY-MM-DD format for the prompt
    const [todayMonth, todayDay, todayYear] = todayInEastern.split('/');
    const todayFormatted = `${todayYear}-${todayMonth.padStart(2, '0')}-${todayDay.padStart(2, '0')}`;
    
    const [tomorrowMonth, tomorrowDay, tomorrowYear] = tomorrowInEastern.split('/');
    const tomorrowFormatted = `${tomorrowYear}-${tomorrowMonth.padStart(2, '0')}-${tomorrowDay.padStart(2, '0')}`;
    
    const currentDateTime = now.toLocaleString('en-US', { timeZone: USER_TIMEZONE });
    
    const prompt = `Analyze this text and extract calendar information in ONE response.

Text: "${text}"
Current date/time: ${currentDateTime} (${USER_TIMEZONE})
Current date/time (ISO): ${now.toISOString()}
Today's date: ${todayFormatted}
Tomorrow's date: ${tomorrowFormatted}

Respond with ONLY valid JSON:
{
  "intent": "event" | "vent" | "question" | "unclear",
  "confidence": 0.0-1.0,
  "hasCalendarData": true | false,
  "events": [
    {
      "summary": "Event title",
      "description": "Optional description",
      "start": "ISO 8601 datetime",
      "end": "ISO 8601 datetime",
      "isFlexible": true | false
    }
  ]
}

Intent definitions:
- "event": User wants to schedule calendar events
- "vent": User expressing stress/frustration
- "question": User asking for advice
- "unclear": Cannot determine

Rules for event extraction:
- Extract ALL events mentioned in the text
- Use ISO 8601 format with timezone: "2025-12-03T16:00:00-05:00"
- Default to 30-minute duration if not specified
- For "today", use date: ${todayFormatted}
- For "tomorrow", use date: ${tomorrowFormatted}
- Use Eastern timezone (-05:00)
- Set isFlexible to true for vague times ("sometime", "later", "afternoon")
- For sequential events like "do X then Y", schedule Y after X with buffer time

TIME PARSING (CRITICAL):
- "11:00" or "11" without AM/PM → Assume 11:00 AM (11:00:00), NOT PM
- "12:15", "12:30", "12:45" without AM/PM → 12:15 PM, 12:30 PM, 12:45 PM (afternoon)
- "1:00" or "1" without AM/PM → Assume 1:00 PM (13:00:00) if after noon
- Times 1-11 without AM/PM → Assume AM
- Times 12 without AM/PM → Assume 12:00 PM (noon)
- Only use PM times when explicitly stated or when context clearly indicates afternoon/evening
- If no time specified, default to 9:00 AM

Examples:
- "add laundry at 11:00" → 11:00 AM (not 4:00 PM or 11:00 PM)
- "pick up kids at 4pm" → 4:00 PM (16:00)
- "meeting at 2 then lunch" → 2:00 PM and 3:00 PM
- "groceries tomorrow" → tomorrow at 9:00 AM (flexible)`;

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
    
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error analyzing and extracting events:', error);
    return {
      intent: 'unclear',
      confidence: 0,
      hasCalendarData: false,
      events: []
    };
  }
}

export async function quickConflictCheck(newEvents, existingEvents) {
  try {
    if (!existingEvents || existingEvents.length === 0) {
      return {
        events: newEvents.map(e => ({ ...e, hasConflict: false })),
        summary: 'No existing events'
      };
    }

    const relevantEvents = existingEvents.filter(event => {
      const eventStart = new Date(event.start);
      const now = new Date();
      return eventStart >= now;
    });

    if (relevantEvents.length === 0) {
      return {
        events: newEvents.map(e => ({ ...e, hasConflict: false })),
        summary: 'No relevant existing events'
      };
    }

    const prompt = `Check conflicts between NEW and EXISTING events.

EXISTING: ${JSON.stringify(relevantEvents.map(e => ({ title: e.title, start: e.start, end: e.end })))}
NEW: ${JSON.stringify(newEvents.map(e => ({ summary: e.summary, start: e.start, end: e.end })))}

Return ONLY valid JSON:
{
  "events": [
    {
      "summary": "Event name",
      "start": "ISO datetime",
      "end": "ISO datetime", 
      "hasConflict": true or false,
      "conflictsWith": "existing event name or null"
    }
  ]
}

Rules: 
- Flag hasConflict=true ONLY if NEW event overlaps with EXISTING event
- DO NOT flag if two NEW events overlap with each other
- DO NOT flag if the NEW event has the same/similar name as an EXISTING event (ignore case)
  Example: "Post Office" and "post office" are the SAME event, NOT a conflict
- If no overlap with DIFFERENT existing events, hasConflict=false`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = completion.choices[0].message.content.trim();
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const result = JSON.parse(cleanedText);
    
    return {
      events: result.events || newEvents.map(e => ({ ...e, hasConflict: false })),
      summary: 'Conflict check complete'
    };
    
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return {
      events: newEvents.map(e => ({ ...e, hasConflict: false })),
      summary: 'Conflict check skipped'
    };
  }
}

/**
 * Analyzes text to determine if user wants to update/reschedule an event
 */
export async function analyzeUpdateIntent(text, recentEvents = [], allEvents = []) {
  try {
    const now = new Date();
    
    console.log('=== ANALYZE UPDATE INTENT - DATE CALCULATION ===');
    console.log('Server time (now):', now);
    console.log('Server time ISO:', now.toISOString());
    
    // Get today's date in Eastern timezone properly
    const easternTimeStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const easternDate = new Date(easternTimeStr);
    
    console.log('Eastern time string:', easternTimeStr);
    console.log('Eastern date object:', easternDate);
    
    // Extract just the date part in Eastern timezone
    const todayFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const [month, day, year] = todayFormatted.split('/');
    const todayYYYYMMDD = `${year}-${month}-${day}`;
    
    // Calculate tomorrow
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(tomorrowDate);
    
    const [tomorrowMonth, tomorrowDay, tomorrowYear] = tomorrowFormatted.split('/');
    const tomorrowYYYYMMDD = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
    
    const currentDayName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long'
    }).format(now);
    
    console.log('Today formatted (YYYY-MM-DD):', todayYYYYMMDD);
    console.log('Tomorrow formatted (YYYY-MM-DD):', tomorrowYYYYMMDD);
    console.log('Current day name:', currentDayName);
    console.log('Text from user:', text);
    console.log('================================================');

    const recentEventsContext = recentEvents.length > 0 
      ? `Recently created/mentioned events:\n${recentEvents.map((e, i) => 
          `${i + 1}. "${e.summary || e.title}" at ${new Date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York' })}`
        ).join('\n')}`
      : 'No recent events';

    const allEventsContext = allEvents.length > 0
      ? `All calendar events:\n${allEvents.slice(0, 10).map((e, i) => 
          `${i + 1}. "${e.title || e.summary}" at ${new Date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York' })}`
        ).join('\n')}`
      : 'No calendar events';

      const prompt = `Analyze if user wants to update/reschedule an existing event.

CRITICAL - CURRENT DATE/TIME:
- Today is ${currentDayName}, ${todayYYYYMMDD}
- Tomorrow is ${tomorrowYYYYMMDD}
- Current Eastern time: ${now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}

REMEMBER - TIME OF DAY REFERENCES:
- "this morning" = ${todayYYYYMMDD}
- "this afternoon" = ${todayYYYYMMDD}
- "this evening" = ${todayYYYYMMDD}
- "tonight" = ${todayYYYYMMDD}
- "today" = ${todayYYYYMMDD}
- "tomorrow morning" = ${tomorrowYYYYMMDD}
- "tomorrow afternoon" = ${tomorrowYYYYMMDD}
- "tomorrow evening" = ${tomorrowYYYYMMDD}
- "tomorrow night" = ${tomorrowYYYYMMDD}
- "tomorrow" = ${tomorrowYYYYMMDD}

Text: "${text}"

${recentEventsContext}

${allEventsContext}

Respond with ONLY valid JSON:
{
  "isUpdateRequest": true or false,
  "eventToUpdate": "EXACT name of event from the lists above",
  "newTime": "ISO 8601 datetime WITH TIMEZONE (e.g., 2025-12-03T17:45:00-05:00)",
  "newDate": "ISO 8601 date if only date change (YYYY-MM-DD)",
  "newTitle": "new title if renaming",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

CRITICAL: WHEN IS IT AN UPDATE vs NEW EVENT?

UPDATE REQUEST = User explicitly wants to change an EXISTING event:
- "reschedule X to Y"
- "move X to Y"
- "change X to Y"
- "X is too early/late, make it Y"
- User mentions an event name that EXISTS in the lists above

NEW EVENT = User wants to CREATE something new:
- "I need to X"
- "I have to X"
- "Add X to my calendar"
- "Schedule X"
- "Reminder to X"
- User mentions something NOT in the event lists above
- Example: "I need to pick up my prescription" (if "prescription" is NOT in events list) → NEW EVENT

CRITICAL MATCHING RULES:
1. ONLY match to existing events if user mentions a keyword from an event in the lists
2. If user says "pick up prescription" but NO event contains "prescription" → isUpdateRequest: FALSE
3. "reschedule X for/to Y" = update (confidence 1.0)
4. "move X to Y" = update (confidence 1.0)
5. "change X to Y" = update (confidence 1.0)
6. Return EXACT event title from list, not shortened version
7. For time references like "4:30", determine AM/PM from context (default PM for afternoon/evening)

CRITICAL RULES FOR DATES:
1. "this morning/afternoon/evening/tonight" → use ${todayYYYYMMDD}
2. "tomorrow morning/afternoon/evening/night" → use ${tomorrowYYYYMMDD}
3. "today" → use ${todayYYYYMMDD}
4. "tomorrow" → use ${tomorrowYYYYMMDD}
5. ALWAYS include timezone offset: -05:00

TIME OF DAY DEFAULTS:
- "morning" → 09:00:00
- "afternoon" → 14:00:00
- "evening" → 18:00:00
- "night" → 20:00:00

EXAMPLES:
✓ UPDATE: "move pack up boxes to tonight" (event "Pack up all of the boxes" exists)
→ isUpdateRequest: true, eventToUpdate: "Pack up all of the boxes"

✓ UPDATE: "reschedule post office to tomorrow"  (event "Go to the post office" exists)
→ isUpdateRequest: true, eventToUpdate: "Go to the post office"

✗ NEW EVENT: "I need to pick up my prescription tomorrow" (no event contains "prescription")
→ isUpdateRequest: FALSE

✗ NEW EVENT: "Schedule dentist for 3pm" (no event contains "dentist")
→ isUpdateRequest: FALSE

CRITICAL: Check if the event actually EXISTS in the lists before marking isUpdateRequest: true!`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const responseText = completion.choices[0].message.content.trim();
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const result = JSON.parse(cleanedText);
    console.log('Update intent analysis:', result);
    
    // FALLBACK: If timezone is missing, add it
    if (result.newTime && !result.newTime.includes('-05:00') && !result.newTime.includes('Z')) {
      console.warn('Timezone missing from newTime, adding -05:00');
      result.newTime = result.newTime + '-05:00';
    }
    
    return result;
  } catch (error) {
    console.error('Error analyzing update intent:', error);
    return {
      isUpdateRequest: false,
      eventToUpdate: '',
      confidence: 0
    };
  }
}

/**
 * Analyzes text to determine if user wants to delete/cancel events
 */
export async function analyzeDeleteIntent(text) {
  try {
    const prompt = `Analyze if user wants to delete/cancel calendar events.

Text: "${text}"

Respond with ONLY valid JSON:
{
  "isDeleteRequest": true or false,
  "eventToDelete": "name of event to delete",
  "confidence": 0.0-1.0
}

Examples of delete requests:
- "Cancel my dentist appointment"
- "Delete the meeting at 2pm"
- "Remove pickup kids"`;

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
    
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error analyzing delete intent:', error);
    return {
      isDeleteRequest: false,
      eventToDelete: '',
      confidence: 0
    };
  }
}

/**
 * Determines if a query would benefit from calendar context
 * Returns true for schedule-related questions, false for general venting
 */
/**
 * Determines if a query would benefit from calendar context
 * Returns true for schedule-related questions, false for general venting
 */
export function shouldUseCalendarContext(text) {
  const lowerText = text.toLowerCase().trim();
  // Explicit schedule keywords
  const scheduleKeywords = [
    'busy', 'schedule', 'appointment', 'appointments', 'free', 'available',
    'calendar', 'planned', 'booked', 'meeting', 'meetings', 'event', 'events',
    'gap', 'time for', 'fit in', 'room for', 'open'
  ];
  // Time-related keywords that often indicate schedule queries
  const timeKeywords = [
    'today', 'tomorrow', 'tonight', 'this week', 'next week',
    'this morning', 'this afternoon', 'this evening',
    'morning', 'afternoon', 'evening', 'night',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
  // Question words that combined with time/schedule indicate a schedule query
  const questionWords = ['what', 'when', 'how', 'do i', 'am i', 'can i', 'could i'];
  // Check for explicit schedule keywords
  const hasScheduleKeyword = scheduleKeywords.some(keyword => lowerText.includes(keyword));
  // Check for time keywords
  const hasTimeKeyword = timeKeywords.some(keyword => lowerText.includes(keyword));
  // Check for question patterns about schedule
  const hasQuestionWord = questionWords.some(word => lowerText.includes(word));
  // Common schedule query patterns
  const schedulePatterns = [
    // "What do I have..." / "What's on my..."
    /what.*(do i have|on my|is my|are my)/,
    // "Am I free..." / "Am I busy..." / "Am I available..."
    /am i.*(free|busy|available|open)/,
    // "Do I have..." / "Do I have any..."
    /do i have.*(any|time|room)/,
    // "When am I..." / "When can I..."
    /when.*(am i|can i|could i|do i)/,
    // "How busy..." / "How many..."
    /how.*(busy|many|much)/,
    // "Can I fit..." / "Can I schedule..." / "Can I add..."
    /can i.*(fit|schedule|add|squeeze)/,
    // "Show me..." / "Tell me..." with time/schedule words
    /(show|tell|give).*(me|my).*(schedule|calendar|appointments|events)/,
  ];
  const matchesPattern = schedulePatterns.some(pattern => pattern.test(lowerText));
  
  // Decision logic:
  // 1. Explicit schedule keyword = YES
  // 2. Question word + time keyword = YES (e.g., "what tomorrow")
  // 3. Matches a schedule pattern = YES
  // 4. Has time keyword but no question = MAYBE (could be "tomorrow is busy" = venting)
  
  if (hasScheduleKeyword) {
    console.log('✓ Schedule context: Has schedule keyword');
    return true;
  }
  
  if (matchesPattern) {
    console.log('✓ Schedule context: Matches schedule pattern');
    return true;
  }
  
  if (hasQuestionWord && hasTimeKeyword) {
    console.log('✓ Schedule context: Question + time keyword');
    return true;
  }
  
  // Time keyword alone is not enough (could be venting)
  console.log('✗ No schedule context: General statement or venting');
  return false;
}

/**
 * Generates empathetic response with optional calendar context
 * Calendar context only included when query is about scheduling
 */
export async function generateEmpatheticResponse(text, conversationHistory = [], calendarContext = null, userSettings = null) {
  try {
    console.log('\n=== Generating Empathy Response ===');
    console.log('Text:', text);
    console.log('Calendar context received?', !!calendarContext);

    // Extract empathy settings
    const empathyLevel = userSettings?.level || 'balanced';
    const tone = userSettings?.tone || 'professional';
    console.log('Empathy settings:', { empathyLevel, tone });
    
    // Adjust system prompt based on settings
    const empathyDescriptions = {
      minimal: 'Be concise and direct. Keep responses to 1-2 sentences. Focus on actionable information.',
      balanced: 'Keep responses concise (2-3 sentences) while being supportive. Balance empathy with efficiency.',
      high: 'Show deep understanding and warmth. Take time to validate feelings (3-4 sentences). Offer emotional support alongside practical help.'
    };
    
    const toneDescriptions = {
      professional: 'Be warm but professional. Use clear, respectful language.',
      friendly: 'Be casual and approachable. Use conversational language.',
      warm: 'Be caring and personal. Use gentle, compassionate language.'
    };
    
    let systemPrompt = `You are a supportive AI assistant helping someone from the "Sandwich Generation" - adults caring for aging parents while raising their own children.

Your role:
- Listen with empathy and validate their feelings
- ${empathyDescriptions[empathyLevel]}
- ${toneDescriptions[tone]}
- Offer actionable next steps only when appropriate
- Recognize when they just need to vent vs. need help`;
    
    if (calendarContext) {
      console.log('Calendar context structure:', JSON.stringify(calendarContext, null, 2));
      console.log('Has events?', calendarContext.events && calendarContext.events.length > 0);
      console.log('Is empty?', calendarContext.isEmpty);
    }

    // Add calendar context only if provided AND has data
    if (calendarContext) {
      const currentDate = calendarContext.currentDate || 'today';
      const timeRange = calendarContext.timeRange || 'upcoming';
      
      console.log('Processing calendar context...');
      console.log('  Current date:', currentDate);
      console.log('  Time range:', timeRange);
      console.log('  Is empty:', calendarContext.isEmpty);
      console.log('  Event count:', calendarContext.count);
      
      systemPrompt += `\n\n=== CALENDAR ACCESS ===`;
      systemPrompt += `\nCurrent date/time: ${currentDate}`;
      systemPrompt += `\nUser asked about: ${timeRange}`;
      
      if (calendarContext.isEmpty || !calendarContext.events || calendarContext.events.length === 0) {
        console.log('  Adding EMPTY calendar message');
        systemPrompt += `\n\nIMPORTANT: The user has NO events scheduled for ${timeRange}.`;
        systemPrompt += `\nResult: ZERO events found. The calendar is EMPTY for ${timeRange}.`;
        systemPrompt += `\n\nYou MUST respond with something like:`;
        systemPrompt += `\n- "You're free ${timeRange}! No events scheduled."`;
        systemPrompt += `\n- "Your calendar is clear for ${timeRange}."`;
        systemPrompt += `\n- "Good news - nothing scheduled ${timeRange}!"`;
        systemPrompt += `\n\nDO NOT say you don't have access. You DO have access and found zero events.`;
      } else {
        console.log('  Adding event list to prompt');
        systemPrompt += `\n\nUser's calendar for ${timeRange}:`;
        
        calendarContext.events.forEach((e, i) => {
          const time = new Date(e.start).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            timeZone: 'America/New_York'
          });
          const eventLine = `\n${i + 1}. "${e.title}" on ${e.dayOfWeek}, ${e.date} at ${time}`;
          systemPrompt += eventLine;
          console.log('  Event added:', eventLine.trim());
        });
        
        systemPrompt += `\n\nThese are ALL the events for ${timeRange}. There are ${calendarContext.events.length} event${calendarContext.events.length !== 1 ? 's' : ''} total.`;
      }
      
      systemPrompt += `\n\nRULES:`;
      systemPrompt += `\n- You HAVE calendar access for ${timeRange}`;
      systemPrompt += `\n- List the events shown above`;
      systemPrompt += `\n- If no events are listed, say they are free`;
      systemPrompt += `\n- DO NOT invent events not listed`;
      systemPrompt += `\n- DO NOT say you don't have access`;
      
    } else {
      console.log('NO calendar context provided');
      systemPrompt += `\n\nYou do NOT have access to the user's calendar. DO NOT make up or mention specific appointments, times, or events. Only acknowledge what the user explicitly tells you.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: text }
    ];

    console.log('Calling OpenAI with', messages.length, 'messages');
    console.log('User message:', text);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150,
    });

    const response = completion.choices[0].message.content.trim();
    console.log('AI Response:', response);
    console.log('===================================\n');
    
    return response;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Generates audio from text using OpenAI TTS
 */
/**
 * Generates audio from text using OpenAI TTS
 */
export async function generateSpeech(text, voice = 'nova', speed = 0.95) {
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice, // Use provided voice
      input: text.slice(0, 4096),
      speed: speed, // Use provided speed
    });

    return Buffer.from(await mp3.arrayBuffer());
  } catch (error) {
    console.error('Error generating speech:', error);
    throw new Error('Failed to generate speech');
  }
}