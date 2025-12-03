import { useState } from 'react';
import { checkUpdateIntent } from '../services/googleCalendar.js';
import { processUserInput } from '../services/speechService.js';
import { playTextToSpeech } from '../services/ttsService.js';
import { 
  handleEventUpdate, 
  handleMultipleEventsCreation, 
  handleEventDeletion 
} from '../utils/messageHandlers.js';

export default function useMessageProcessing({
  googleAccessToken,
  calendarEvents,
  setCalendarEvents,
  recentlyCreatedEvents,
  setRecentlyCreatedEvents,
  userSettings,
  isSpeaking,
  setIsSpeaking
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState(null);

  const processMessage = async (text) => {
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    
    const thinkingMessages = [
      "One moment, I'm processing...",
      "I'm thinking..."
    ];
    const randomThinking = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
    
    const thinkingMessage = { role: 'assistant', content: randomThinking, isTemporary: true };
    setMessages(prev => [...prev, thinkingMessage]);
    
    setLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // PRIORITY 1: Check pending reschedule
      if (pendingReschedule) {
        const cancelWords = ['no', 'wrong', 'not that', 'different', 'cancel', 'nevermind'];
        if (cancelWords.some(word => text.toLowerCase().includes(word))) {
          setMessages(prev => prev.filter(m => !m.isTemporary));
          setPendingReschedule(null);
          
          const cancelMessage = "No problem! Which event did you want to reschedule?";
          setMessages(prev => [...prev, { role: 'assistant', content: cancelMessage }]);
          
          if (userSettings.tts.enabled) {
            playTextToSpeech(cancelMessage, setIsSpeaking, userSettings);
          }
          
          setLoading(false);
          return;
        }
        
        const updateAnalysis = await checkUpdateIntent(text, [pendingReschedule], []);
        
        if (updateAnalysis.newTime || updateAnalysis.newDate) {
          setMessages(prev => prev.filter(m => !m.isTemporary));
          await handleEventUpdate(
            updateAnalysis,
            pendingReschedule,
            googleAccessToken,
            userSettings,
            setMessages,
            setCalendarEvents,
            setRecentlyCreatedEvents,
            setPendingReschedule,
            isSpeaking,
            setIsSpeaking
          );
          setLoading(false);
          return;
        }
      }
      
      // PRIORITY 2: Check update intent
      const updateAnalysis = await checkUpdateIntent(text, recentlyCreatedEvents, calendarEvents);
      
      if (updateAnalysis.isUpdateRequest && updateAnalysis.confidence > 0.5) {
        const eventNameFromAI = (updateAnalysis.eventToUpdate || '').toLowerCase();
        
        let eventToUpdate = [...recentlyCreatedEvents, ...calendarEvents].find(e => {
          const eName = (e.summary || e.title || '').toLowerCase();
          return eName === eventNameFromAI || 
                 eName.includes(eventNameFromAI) ||
                 eventNameFromAI.split(' ').filter(w => w.length > 3).some(word => eName.includes(word));
        });
      
        if (eventToUpdate) {
          setMessages(prev => prev.filter(m => !m.isTemporary));
          await handleEventUpdate(
            updateAnalysis,
            eventToUpdate,
            googleAccessToken,
            userSettings,
            setMessages,
            setCalendarEvents,
            setRecentlyCreatedEvents,
            setPendingReschedule,
            isSpeaking,
            setIsSpeaking
          );
          setLoading(false);
          return;
        }
      }

      // PRIORITY 3: Regular processing
      const response = await processUserInput(text, conversationHistory, calendarEvents, userSettings);

      setMessages(prev => {
        const filtered = prev.filter(m => !m.isTemporary);
        return [...filtered, { 
          role: 'assistant', 
          content: response.text,
          intent: response.intent 
        }];
      });

      if (response.text && !isSpeaking) {
        playTextToSpeech(response.text, setIsSpeaking, userSettings);
      }

      // Handle delete requests
      if (response.intent === 'delete' && response.eventsToDelete) {
        if (response.requiresConfirmation) {
          console.log('Waiting for user confirmation to delete:', response.eventsToDelete);
        }
      }
      
      // Handle conflicts
      if (response.requiresUserDecision && response.hasConflicts) {
        console.log('Conflicts detected, waiting for user decision');
      } 
      // Handle event creation
      else if (response.eventsData && Array.isArray(response.eventsData) && response.eventsData.length > 0 && googleAccessToken) {
        const eventsToCreate = response.eventsData.filter(e => !e.hasConflict);
        
        if (eventsToCreate.length > 0) {
          const createdEvents = await handleMultipleEventsCreation(
            eventsToCreate,
            googleAccessToken,
            setCalendarEvents,
            setMessages
          );
          setRecentlyCreatedEvents(prev => [...createdEvents, ...prev].slice(0, 3));
        }
      } else if (response.eventsData && !googleAccessToken) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Would you like me to add these to your calendar? Please connect your Google Calendar first.'
        }]);
      }

      // Handle deletion confirmations
      if (messages.length > 0) {
        const lastAssistantMessage = messages[messages.length - 1];
        if (lastAssistantMessage.content && lastAssistantMessage.content.includes('Would you like me to delete')) {
          const confirmWords = ['yes', 'yeah', 'sure', 'ok', 'okay', 'delete it', 'remove it', 'confirm'];
          const cancelWords = ['no', 'nope', 'cancel', 'nevermind', 'don\'t'];
          
          const lowerText = text.toLowerCase();
          
          if (confirmWords.some(word => lowerText.includes(word))) {
            if (response.eventsToDelete && response.eventsToDelete.length > 0) {
              await handleEventDeletion(
                response.eventsToDelete[0],
                googleAccessToken,
                setCalendarEvents,
                setMessages
              );
            }
          } else if (cancelWords.some(word => lowerText.includes(word))) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'Okay, I won\'t delete that event.'
            }]);
          }
        }
      }

    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isTemporary);
        return [...filtered, {
          role: 'assistant',
          content: `I'm having trouble processing that right now. ${error.message}`
        }];
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    setMessages,
    loading,
    processMessage
  };
}