import { useState } from 'react';
import { checkUpdateIntent } from '../services/googleCalendar.js';
import { processUserInput } from '../services/speechService.js';
import { playTextToSpeech } from '../services/ttsService.js';
import { 
  handleEventUpdate, 
  handleMultipleEventsCreation, 
  handleEventDeletion 
} from '../utils/messageHandlers.js';

// Constants
const MAX_RECENT_EVENTS = 3;
const THINKING_MESSAGES = [
  "Just a moment...",
  "One second...",
  "Got it...",
  "I see...",
  "One moment..."
];

// Pending state types
const PENDING_STATES = {
  NONE: 'none',
  RESCHEDULE: 'reschedule',
  CONFLICT: 'conflict',
  DELETE: 'delete'
};

const MAX_RESCHEDULE_ATTEMPTS = 3; // Maximum retry attempts before giving up

/**
 * Custom hook for processing user messages with proper state management
 * Handles message flow, pending operations, and calendar event management
 */
export default function useMessageProcessing({
  googleAccessToken,
  calendarEvents,
  setCalendarEvents,
  recentlyCreatedEvents,
  setRecentlyCreatedEvents,
  userSettings,
  isSpeaking,
  setIsSpeaking,
  userEmail,
  userName
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Unified pending state - only one operation can be pending at a time
  const [pendingOperation, setPendingOperation] = useState({
    type: PENDING_STATES.NONE,
    data: null,
    retryCount: 0 // Track number of retry attempts
  });

  /**
   * Utility: Get random thinking message
   */
  const getRandomThinkingMessage = () => {
    return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
  };

  /**
   * Utility: Clean text for TTS (remove symbols, adjust phrasing)
   */
  const cleanTextForTTS = (text) => {
    return text
      .replace(/✓\s*/g, '')
      .replace(/All (\d+) event/g, '$1 event')
      .trim();
  };

  /**
   * Utility: Remove temporary messages and add new assistant message
   */
  const replaceTemporaryMessage = (content, additionalProps = {}) => {
    setMessages(prev => {
      const filtered = prev.filter(m => !m.isTemporary);
      return [...filtered, { 
        role: 'assistant', 
        content,
        ...additionalProps
      }];
    });
  };

  /**
   * Utility: Check if message should skip TTS (visual-only confirmations)
   */
  const shouldSkipTTS = (text) => {
    if (!text) return true;
    
    // Skip TTS for visual-only confirmation messages (after action is complete)
    // These start with ✓ and confirm something was done
    const visualOnlyPatterns = [
      /^✓/,  // Any message starting with checkmark is visual-only
    ];
    
    return visualOnlyPatterns.some(pattern => pattern.test(text.trim()));
  };

  /**
   * Utility: Play TTS if enabled (skip visual-only confirmations)
   */
  const playTTSIfEnabled = async (text) => {
    if (userSettings?.tts?.enabled && text && !shouldSkipTTS(text)) {
      const cleanedText = cleanTextForTTS(text);
      await playTextToSpeech(cleanedText, setIsSpeaking, userSettings);
    }
  };

  /**
   * Utility: Add events to recent list
   */
  const addToRecentEvents = (events) => {
    const eventsArray = Array.isArray(events) ? events : [events];
    setRecentlyCreatedEvents(prev => [...eventsArray, ...prev].slice(0, MAX_RECENT_EVENTS));
  };

  /**
   * Utility: Clear pending operation
   */
  const clearPendingOperation = () => {
    setPendingOperation({ type: PENDING_STATES.NONE, data: null, retryCount: 0 });
  };

  /**
   * Handler: Pending reschedule operation
   */
  const handlePendingReschedule = async (text) => {
    const { data: eventToReschedule, retryCount } = pendingOperation;
    
    // Check for cancellation
    const cancelWords = ['no', 'wrong', 'not that', 'different', 'cancel', 'nevermind'];
    if (cancelWords.some(word => text.toLowerCase().includes(word))) {
      replaceTemporaryMessage("No problem! Which event did you want to reschedule?");
      await playTTSIfEnabled("No problem! Which event did you want to reschedule?");
      clearPendingOperation();
      return;
    }
    
    // Filter out null/undefined events before sending to backend
    const validCalendarEvents = (calendarEvents || []).filter(e => e != null);
    
    // Try to extract new time from user's response
    const updateAnalysis = await checkUpdateIntent(text, [eventToReschedule], validCalendarEvents);
    
    if (updateAnalysis.newTime || updateAnalysis.newDate) {
      // Remove temporary message - handleEventUpdate will add its own
      setMessages(prev => prev.filter(m => !m.isTemporary));
      await handleEventUpdate(
        updateAnalysis,
        eventToReschedule,
        googleAccessToken,
        userSettings,
        setMessages,
        setCalendarEvents,
        setRecentlyCreatedEvents,
        (data) => setPendingOperation({ type: PENDING_STATES.RESCHEDULE, data, retryCount: 0 }),
        isSpeaking,
        setIsSpeaking,
        userEmail
      );
      clearPendingOperation();
    } else {
      // Check if we've exceeded max retry attempts
      if (retryCount >= MAX_RESCHEDULE_ATTEMPTS - 1) {
        const giveUpMessage = "I'm having trouble understanding the time. Let's try again from the start - which event would you like to reschedule?";
        replaceTemporaryMessage(giveUpMessage);
        await playTTSIfEnabled(giveUpMessage);
        clearPendingOperation();
        return;
      }
      
      // Still couldn't understand the new time - increment retry counter
      const clarification = "I'm not sure about that time. Could you say it again? For example, 'tomorrow at 3pm' or 'next Monday at 10am'.";
      replaceTemporaryMessage(clarification);
      await playTTSIfEnabled(clarification);
      
      // Increment retry count but stay in pending state
      setPendingOperation({
        type: PENDING_STATES.RESCHEDULE,
        data: eventToReschedule,
        retryCount: retryCount + 1
      });
    }
  };

  /**
   * Handler: Pending conflict resolution
   */
  const handlePendingConflict = async (text) => {
    const { data: conflictingEvent } = pendingOperation;
    const lowerText = text.toLowerCase();
    
    const confirmWords = ['add it', 'add anyway', 'yes', 'yeah', 'sure', 'ok', 'okay', 'go ahead', 'do it'];
    const cancelWords = ['cancel', 'no', 'nope', 'nevermind', "don't"];
    const rescheduleWords = ['after', 'different time', 'later', 'reschedule', 'move it'];
    
    // User confirms: add it anyway
    if (confirmWords.some(word => lowerText.includes(word)) && 
        !rescheduleWords.some(word => lowerText.includes(word))) {
      // Remove temporary message - handler will add its own
      setMessages(prev => prev.filter(m => !m.isTemporary));
      
      const result = await handleMultipleEventsCreation(
        [conflictingEvent],
        googleAccessToken,
        setCalendarEvents,
        setMessages,
        userEmail
      );
      
      addToRecentEvents(result.events);
      await playTTSIfEnabled(result.message);
      clearPendingOperation();
      return;
    }
    
    // User cancels
    if (cancelWords.some(word => lowerText.includes(word))) {
      const cancelMessage = "No problem, I won't add that event.";
      replaceTemporaryMessage(cancelMessage);
      await playTTSIfEnabled(cancelMessage);
      clearPendingOperation();
      return;
    }
    
    // User wants to reschedule
    if (rescheduleWords.some(word => lowerText.includes(word))) {
      await handleConflictReschedule(text, conflictingEvent, lowerText);
      return;
    }
    
    // Didn't understand the response
    const clarification = "I didn't catch that. Would you like me to add it anyway, or would you prefer to cancel?";
    replaceTemporaryMessage(clarification);
    await playTTSIfEnabled(clarification);
  };

  /**
   * Sub-handler: Reschedule a conflicting event
   */
  const handleConflictReschedule = async (text, conflictingEvent, lowerText) => {
    // Check if user said "after X" where X is an existing event
    const afterMatch = lowerText.match(/after\s+(.+?)(?:\s+ends?)?(?:\s+|$)/);
    
    if (afterMatch) {
      const eventKeyword = afterMatch[1].trim();
      const existingEvent = calendarEvents.find(e => {
        const eventName = (e.summary || e.title || '').toLowerCase();
        return eventName.includes(eventKeyword) || 
               eventKeyword.split(' ').some(word => eventName.includes(word));
      });
      
      if (existingEvent) {
        // Schedule after the existing event
        const conflictEnd = new Date(existingEvent.end);
        const duration = new Date(conflictingEvent.end) - new Date(conflictingEvent.start);
        
        const updatedEvent = {
          ...conflictingEvent,
          start: conflictEnd.toISOString(),
          end: new Date(conflictEnd.getTime() + duration).toISOString()
        };
        
        // Remove temporary message - handler will add its own
        setMessages(prev => prev.filter(m => !m.isTemporary));
        
        const result = await handleMultipleEventsCreation(
          [updatedEvent],
          googleAccessToken,
          setCalendarEvents,
          setMessages,
          userEmail
        );
        
        addToRecentEvents(result.events);
        await playTTSIfEnabled(result.message);
        clearPendingOperation();
        return;
      }
    }
    
    // Filter out null/undefined events before sending to backend
    const validCalendarEvents = (calendarEvents || []).filter(e => e != null);
    
    // Try to parse a new time from the message
    const updateAnalysis = await checkUpdateIntent(text, [conflictingEvent], validCalendarEvents);
    
    if (updateAnalysis.newTime || updateAnalysis.newDate) {
      const duration = new Date(conflictingEvent.end) - new Date(conflictingEvent.start);
      const newStartTime = updateAnalysis.newTime || conflictingEvent.start;
      
      const updatedEvent = {
        ...conflictingEvent,
        start: newStartTime,
        end: new Date(new Date(newStartTime).getTime() + duration).toISOString()
      };
      
      // Remove temporary message - handler will add its own
      setMessages(prev => prev.filter(m => !m.isTemporary));
      
      const result = await handleMultipleEventsCreation(
        [updatedEvent],
        googleAccessToken,
        setCalendarEvents,
        setMessages,
        userEmail
      );
      
      addToRecentEvents(result.events);
      await playTTSIfEnabled(result.message);
      clearPendingOperation();
    } else {
      const clarification = "When would you like to schedule it instead? For example, 'tomorrow at 2pm' or 'next Monday at 10am'.";
      replaceTemporaryMessage(clarification);
      await playTTSIfEnabled(clarification);
    }
  };

  /**
   * Handler: Pending delete confirmation
   */
  const handlePendingDelete = async (text) => {
    const { data: eventsToDelete } = pendingOperation;
    const lowerText = text.toLowerCase();
    
    const confirmWords = ['yes', 'yeah', 'sure', 'ok', 'okay', 'delete it', 'remove it', 'confirm'];
    const cancelWords = ['no', 'nope', 'cancel', 'nevermind', "don't"];
    
    if (confirmWords.some(word => lowerText.includes(word))) {
      // Remove temporary message - handler will add its own
      setMessages(prev => prev.filter(m => !m.isTemporary));
      
      if (eventsToDelete && eventsToDelete.length > 0) {
        await handleEventDeletion(
          eventsToDelete[0],
          googleAccessToken,
          setCalendarEvents,
          setMessages,
          userEmail
        );
      }
      
      clearPendingOperation();
    } else if (cancelWords.some(word => lowerText.includes(word))) {
      const cancelMessage = "Okay, I won't delete that event.";
      replaceTemporaryMessage(cancelMessage);
      await playTTSIfEnabled(cancelMessage);
      clearPendingOperation();
    } else {
      const clarification = "I didn't catch that. Would you like me to delete this event? Please say yes or no.";
      replaceTemporaryMessage(clarification);
      await playTTSIfEnabled(clarification);
    }
  };

  /**
   * Handler: Check and handle update intent
   */
  const handleUpdateRequest = async (text, conversationHistory) => {
    // Filter out any null/undefined events before sending to backend
    const validRecentEvents = (recentlyCreatedEvents || []).filter(e => e != null);
    const validCalendarEvents = (calendarEvents || []).filter(e => e != null);
    
    const updateAnalysis = await checkUpdateIntent(text, validRecentEvents, validCalendarEvents);
    
    if (!updateAnalysis.isUpdateRequest || updateAnalysis.confidence <= 0.5) {
      return false; // Not an update request
    }
    
    console.log('=== FRONTEND: Looking for event to update ===');
    console.log('Event name from AI:', updateAnalysis.eventToUpdate);
    console.log('Available recent events:', validRecentEvents.map(e => ({name: e.summary || e.title, id: e.id})));
    console.log('Available calendar events:', validCalendarEvents.map(e => ({name: e.summary || e.title, id: e.id})));
    
    // Find the event to update
    const eventNameFromAI = (updateAnalysis.eventToUpdate || '').toLowerCase();
    const allValidEvents = [...validRecentEvents, ...validCalendarEvents].filter(e => e != null);
    
    const eventToUpdate = allValidEvents.find(e => {
      const eventName = (e.summary || e.title || '').toLowerCase();
      return eventName === eventNameFromAI || 
             eventName.includes(eventNameFromAI) ||
             eventNameFromAI.includes(eventName) ||
             eventNameFromAI.split(' ').filter(w => w.length > 3).some(word => eventName.includes(word));
    });
    
    if (!eventToUpdate) {
      console.log('❌ No matching event found');
    } else {
      console.log('✓ Found event:', eventToUpdate.summary || eventToUpdate.title, 'ID:', eventToUpdate.id);
    }
    console.log('===============================================');
    
    if (eventToUpdate) {
      // Remove temporary message - handleEventUpdate will add its own
      setMessages(prev => prev.filter(m => !m.isTemporary));
      await handleEventUpdate(
        updateAnalysis,
        eventToUpdate,
        googleAccessToken,
        userSettings,
        setMessages,
        setCalendarEvents,
        setRecentlyCreatedEvents,
        (data) => setPendingOperation({ type: PENDING_STATES.RESCHEDULE, data, retryCount: 0 }),
        isSpeaking,
        setIsSpeaking,
        userEmail
      );
      return true;
    }
    
    return false;
  };

  /**
   * Handler: Process regular message (not pending operation)
   */
  const handleRegularMessage = async (text, conversationHistory) => {
    const response = await processUserInput(text, conversationHistory, calendarEvents, userSettings);
    
    replaceTemporaryMessage(response.text, { intent: response.intent });
    await playTTSIfEnabled(response.text);
    
    // Handle delete intent with confirmation
    if (response.intent === 'delete' && response.requiresConfirmation && response.eventsToDelete) {
      setPendingOperation({
        type: PENDING_STATES.DELETE,
        data: response.eventsToDelete,
        retryCount: 0
      });
      return;
    }
    
    // Handle conflicts - need user decision
    if (response.requiresUserDecision && response.hasConflicts && response.eventsData?.length > 0) {
      setPendingOperation({
        type: PENDING_STATES.CONFLICT,
        data: response.eventsData[0], // Store first conflicting event
        retryCount: 0
      });
      return;
    }
    
    // Handle event creation (no conflicts)
    if (response.eventsData?.length > 0 && googleAccessToken) {
      const eventsToCreate = response.eventsData.filter(e => !e.hasConflict);
      
      if (eventsToCreate.length > 0) {
        const result = await handleMultipleEventsCreation(
          eventsToCreate,
          googleAccessToken,
          setCalendarEvents,
          setMessages,
          userEmail
        );
        
        addToRecentEvents(result.events);
        await playTTSIfEnabled(result.message);
      }
    } else if (response.eventsData?.length > 0 && !googleAccessToken) {
      const noAuthMessage = 'Would you like me to add these to your calendar? Please connect your Google Calendar first.';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: noAuthMessage
      }]);
      await playTTSIfEnabled(noAuthMessage);
    }
  };

  /**
   * Utility: Check if message is a quick response (yes/no/cancel)
   */
  const isQuickResponse = (text) => {
    const quickWords = [
      'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 
      'no', 'nope', 'nah', 
      'cancel', 'nevermind', 'never mind',
      'confirm', 'accept', 'decline',
      'add it', 'add anyway', 'go ahead', 'do it'
    ];
    
    const lowerText = text.toLowerCase().trim();
    
    // Check if the entire message is just a quick word (or very short)
    if (lowerText.length <= 15) {
      return quickWords.some(word => lowerText === word || lowerText.includes(word));
    }
    
    return false;
  };

  /**
   * Main message processing function
   */
  const processMessage = async (text) => {
    if (!text?.trim()) return;
    
    // Add user message
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    
    // Check if we should skip the thinking message for quick responses to pending operations
    const hasPendingOperation = pendingOperation.type !== PENDING_STATES.NONE;
    const skipThinking = hasPendingOperation && isQuickResponse(text);
    
    // Show thinking message (unless it's a quick response to a pending operation)
    if (!skipThinking) {
      const thinkingMessage = getRandomThinkingMessage();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: thinkingMessage, 
        isTemporary: true 
      }]);
      
      await playTTSIfEnabled(thinkingMessage);
    }
    
    setLoading(true);

    try {
      // PRIORITY 1: Handle pending operations first (no API calls needed)
      if (pendingOperation.type === PENDING_STATES.RESCHEDULE) {
        await handlePendingReschedule(text);
        return;
      }
      
      if (pendingOperation.type === PENDING_STATES.CONFLICT) {
        await handlePendingConflict(text);
        return;
      }
      
      if (pendingOperation.type === PENDING_STATES.DELETE) {
        await handlePendingDelete(text);
        return;
      }
      
      // PRIORITY 2: Check for update intent
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const wasUpdateRequest = await handleUpdateRequest(text, conversationHistory);
      if (wasUpdateRequest) {
        return;
      }
      
      // PRIORITY 3: Regular message processing
      await handleRegularMessage(text, conversationHistory);
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Remove thinking message and show error
      const errorMessage = `I'm having trouble processing that right now. ${error.message || 'Please try again.'}`;
      replaceTemporaryMessage(errorMessage);
      await playTTSIfEnabled(errorMessage);
      
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    setMessages,
    loading,
    processMessage,
    pendingOperation, // Expose for debugging/testing
    clearPendingOperation // Expose for manual clearing if needed
  };
}