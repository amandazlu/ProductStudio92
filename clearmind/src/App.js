import React, { useState, useEffect } from 'react';
import Header from './components/Header.js';
import SettingsPanel from './components/SettingsPanel.js';
import MessageList from './components/MessageList.js';
import InputArea from './components/InputArea.js';
import CalendarView from './components/CalendarView.js';
import SignIn from './components/SignIn.js';
import useSpeechToText from './hooks/useSpeechToText.js';
import { processUserInput } from './services/speechService.js';
import { fetchCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, checkUpdateIntent } from './services/googleCalendar.js';
import { playTextToSpeech } from './services/ttsService.js';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Message and conversation state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // API settings
  const [apiConfigured, setApiConfigured] = useState(false);

  // Google Calendar state
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Recently created events for update context
  const [recentlyCreatedEvents, setRecentlyCreatedEvents] = useState([]);
  const [pendingReschedule, setPendingReschedule] = useState(null);

  // User preference settings
  const [userSettings, setUserSettings] = useState({
    tts: {
      enabled: true,
      voice: 'nova',
      speed: 0.95,
    },
    empathy: {
      level: 'balanced',
      tone: 'professional',
    }
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('clearmind_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setUserSettings(parsed);
        console.log('Loaded saved settings:', parsed);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('clearmind_settings', JSON.stringify(userSettings));
    console.log('Saved settings:', userSettings);
  }, [userSettings]);

  // Function to update settings
  const updateSettings = (newSettings) => {
    setUserSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  // Check if API is configured
  useEffect(() => {
    const hasApiKey = !!process.env.REACT_APP_API_BASE_URL;
    setApiConfigured(hasApiKey);
    
    if (!hasApiKey) {
      console.warn('API base URL not configured. Please set REACT_APP_API_BASE_URL in .env');
    }
  }, []);

  // Load saved Google token and check authentication on mount
  useEffect(() => {
    const loadSavedToken = async () => {
      try {
        const savedToken = localStorage.getItem('google_calendar_token');
        const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
        
        if (savedToken && tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry, 10);
          const now = Date.now();
          
          // Check if token is still valid (not expired)
          if (now < expiryTime) {
            console.log('Restoring saved Google Calendar token');
            setGoogleAccessToken(savedToken);
            setIsAuthenticated(true);
            
            // Fetch calendar events with saved token
            const events = await fetchCalendarEvents(savedToken);
            setCalendarEvents(events || []);
          } else {
            console.log('Saved token expired, clearing...');
            localStorage.removeItem('google_calendar_token');
            localStorage.removeItem('google_calendar_token_expiry');
          }
        }
      } catch (error) {
        console.error('Error loading saved token:', error);
        // Clear invalid tokens
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_calendar_token_expiry');
      }
    };

    loadSavedToken();
  }, []);

  // Save token when it changes
  const saveGoogleToken = (token) => {
    setGoogleAccessToken(token);
    
    if (token) {
      // Save token to localStorage
      localStorage.setItem('google_calendar_token', token);
      
      // Set expiry to 1 hour from now (Google tokens typically last 1 hour)
      const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
      localStorage.setItem('google_calendar_token_expiry', expiryTime.toString());
      
      console.log('Google Calendar token saved');
    } else {
      // Clear token
      localStorage.removeItem('google_calendar_token');
      localStorage.removeItem('google_calendar_token_expiry');
      console.log('Google Calendar token cleared');
    }
  };

  // Google Sign-In handler
  const handleGoogleSignIn = () => {
    if (!GOOGLE_CLIENT_ID) {
      alert('Google Client ID not configured. Please add REACT_APP_GOOGLE_CLIENT_ID to your .env file.');
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar',
      callback: async (response) => {
        if (response.access_token) {
          saveGoogleToken(response.access_token);
          setIsAuthenticated(true);
          const events = await fetchCalendarEvents(response.access_token);
          setCalendarEvents(events || []);
        }
      },
    });
    client.requestAccessToken();
  };

  // Google Sign-Out handler
  const handleGoogleSignOut = () => {
    saveGoogleToken(''); // This clears localStorage
    setCalendarEvents([]);
    setIsAuthenticated(false);
    setMessages([]);
    setRecentlyCreatedEvents([]);
  };

  // ... rest of your existing functions (sendMessage, processMessage, handleEventUpdate, etc.)
  // Keep all your existing logic here

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    await processMessage(input);
    setInput('');
  };

  const processMessage = async (text) => {
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    
    // Add immediate acknowledgment
    const thinkingMessages = [
      "Got it, let me think about that...",
      "One moment, I'm processing...",
      "Thinking about what you said...",
      "I hear you...",
      "Understood, I'm thinking..."
    ];
    const randomThinking = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
    
    const thinkingMessage = { role: 'assistant', content: randomThinking, isTemporary: true };
    setMessages(prev => [...prev, thinkingMessage]);
    // Play TTS for thinking message immediately
    // if (userSettings.tts.enabled && !isSpeaking) {
    //   playTextToSpeech(randomThinking, setIsSpeaking, userSettings);
    // }
    setLoading(true);
  
    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
  
      console.log('=== FRONTEND: Processing Message ===');
      console.log('Input text:', text);
      
      // PRIORITY 1: Check if we have a pending reschedule
      if (pendingReschedule) {
        console.log('Pending reschedule detected:', pendingReschedule);
        
        // Check if user is canceling
        const cancelWords = ['no', 'wrong', 'not that', 'different', 'cancel', 'nevermind'];
        if (cancelWords.some(word => text.toLowerCase().includes(word))) {
          console.log('User canceling pending reschedule');
          setMessages(prev => prev.filter(m => !m.isTemporary));
          setPendingReschedule(null);
          
          const cancelMessage = "No problem! Which event did you want to reschedule?";
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: cancelMessage
          }]);
          
          if (userSettings.tts.enabled) {
            playTextToSpeech(cancelMessage, setIsSpeaking, userSettings);
          }
          
          setLoading(false);
          return;
        }
        
        // Check if the user is providing a new time
        const updateAnalysis = await checkUpdateIntent(text, [pendingReschedule], []);
        
        console.log('Followup update analysis:', updateAnalysis);
        
        if (updateAnalysis.newTime || updateAnalysis.newDate) {
          setMessages(prev => prev.filter(m => !m.isTemporary));
          await handleEventUpdate(updateAnalysis, pendingReschedule);
          setLoading(false);
          return;
        }
      }
      
      // PRIORITY 2: Check for update intent
      const updateAnalysis = await checkUpdateIntent(text, recentlyCreatedEvents, calendarEvents);
      
      console.log('=== UPDATE ANALYSIS RESULT ===');
      console.log('Is update request:', updateAnalysis.isUpdateRequest);
      console.log('Confidence:', updateAnalysis.confidence);
      console.log('Event to update:', updateAnalysis.eventToUpdate);
      console.log('New time:', updateAnalysis.newTime);
      console.log('==============================');
      
      if (updateAnalysis.isUpdateRequest && updateAnalysis.confidence > 0.5) {
        const eventNameFromAI = (updateAnalysis.eventToUpdate || '').toLowerCase();
        
        console.log('Searching for event matching:', eventNameFromAI);
        console.log('Available events:', [...recentlyCreatedEvents, ...calendarEvents].map(e => ({
          title: e.summary || e.title,
          start: e.start
        })));
        
        // Try multiple matching strategies
        let eventToUpdate = null;
        
        // Strategy 1: Exact match
        eventToUpdate = [...recentlyCreatedEvents, ...calendarEvents].find(e => {
          const eName = (e.summary || e.title || '').toLowerCase();
          return eName === eventNameFromAI;
        });
        
        // Strategy 2: Event name contains the search term
        if (!eventToUpdate) {
          eventToUpdate = [...recentlyCreatedEvents, ...calendarEvents].find(e => {
            const eName = (e.summary || e.title || '').toLowerCase();
            return eName.includes(eventNameFromAI);
          });
        }
        
        // Strategy 3: Search term contains significant words from event name
        if (!eventToUpdate) {
          eventToUpdate = [...recentlyCreatedEvents, ...calendarEvents].find(e => {
            const eName = (e.summary || e.title || '').toLowerCase();
            const eventWords = eventNameFromAI.split(' ').filter(w => w.length > 3); // Words longer than 3 chars
            return eventWords.some(word => eName.includes(word));
          });
        }
        
        console.log('Found event:', eventToUpdate ? (eventToUpdate.summary || eventToUpdate.title) : 'NONE');
      
        if (eventToUpdate) {
          console.log('✓ Found event to update:', eventToUpdate);
          setMessages(prev => prev.filter(m => !m.isTemporary));
          await handleEventUpdate(updateAnalysis, eventToUpdate);
          setLoading(false);
          return;
        } else {
          console.log('✗ No matching event found for:', eventNameFromAI);
          // Fall through to regular processing
        }
      }
  
      // PRIORITY 3: Regular message processing
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
  
      // ... rest of your existing logic (handle events, deletions, etc.)
      
      if (response.intent === 'delete' && response.eventsToDelete) {
        if (response.requiresConfirmation) {
          console.log('Waiting for user confirmation to delete:', response.eventsToDelete);
        }
      } else if (response.requiresUserDecision && response.hasConflicts) {
        console.log('Conflicts detected, waiting for user decision');
      } else if (response.eventsData && Array.isArray(response.eventsData) && response.eventsData.length > 0 && googleAccessToken) {
        const eventsToCreate = response.eventsData.filter(e => !e.hasConflict);
        
        if (eventsToCreate.length > 0) {
          const createdEvents = await handleMultipleEventsCreation(eventsToCreate);
          setRecentlyCreatedEvents(prev => [...createdEvents, ...prev].slice(0, 3));
        }
      } else if (response.eventsData && !googleAccessToken) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Would you like me to add these to your calendar? Please connect your Google Calendar first.'
        }]);
      }
  
      if (messages.length > 0) {
        const lastAssistantMessage = messages[messages.length - 1];
        if (lastAssistantMessage.content && lastAssistantMessage.content.includes('Would you like me to delete')) {
          const confirmWords = ['yes', 'yeah', 'sure', 'ok', 'okay', 'delete it', 'remove it', 'confirm'];
          const cancelWords = ['no', 'nope', 'cancel', 'nevermind', 'don\'t'];
          
          const lowerText = text.toLowerCase();
          
          if (confirmWords.some(word => lowerText.includes(word))) {
            if (response.eventsToDelete && response.eventsToDelete.length > 0) {
              await handleEventDeletion(response.eventsToDelete[0]);
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
      
      // Remove thinking message on error
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

  const handleMultipleEventsCreation = async (eventsData) => {
    try {
      let successCount = 0;
      let failCount = 0;
      const createdEventsList = [];

      for (const eventData of eventsData) {
        try {
          const createdEvent = await createCalendarEvent(googleAccessToken, eventData);
          
          const eventObj = {
            id: createdEvent.id,
            title: createdEvent.summary,
            summary: createdEvent.summary,
            description: createdEvent.description,
            start: createdEvent.start.dateTime || createdEvent.start.date,
            end: createdEvent.end.dateTime || createdEvent.end.date
          };
          
          setCalendarEvents(prev => [...prev, eventObj]);
          createdEventsList.push(eventObj);
          
          successCount++;
        } catch (error) {
          console.error('Error creating individual event:', error);
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✓ All ${successCount} event${successCount > 1 ? 's' : ''} added to your calendar!` 
        }]);
      } else if (successCount > 0 && failCount > 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✓ ${successCount} event${successCount > 1 ? 's' : ''} added. ${failCount} failed to create.` 
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I had trouble adding those to your calendar. Please try again.'
        }]);
      }

      return createdEventsList;

    } catch (error) {
      console.error('Error creating multiple events:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble adding those to your calendar. Please try again.'
      }]);
      return [];
    }
  };

  const handleEventDeletion = async (event) => {
    if (!googleAccessToken || !event || !event.id) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I couldn\'t delete that event. Please try again.'
      }]);
      return;
    }
  
    try {
      await deleteCalendarEvent(googleAccessToken, event.id);
      
      setCalendarEvents(prev => prev.filter(e => e.id !== event.id));
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✓ I've deleted "${event.title}" from your calendar.`
      }]);
      
    } catch (error) {
      console.error('Error deleting event:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble deleting that event. Please try again.'
      }]);
    }
  };

  const handleEventUpdate = async (updateAnalysis, eventToUpdate) => {
    if (!googleAccessToken || !eventToUpdate) {
      setMessages(prev => prev.filter(m => !m.isTemporary));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I couldn\'t update that event. Please try again.'
      }]);
      return;
    }
  
    // Check if we have enough information to update
    if (!updateAnalysis.newTime && !updateAnalysis.newDate && !updateAnalysis.newTitle) {
      console.log('Not enough info to update - asking for clarification');
      
      setMessages(prev => prev.filter(m => !m.isTemporary));
      
      const eventStart = new Date(eventToUpdate.start);
      const now = new Date();
      
      // Check if event is today or tomorrow
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const dayAfterStart = new Date(todayStart);
      dayAfterStart.setDate(dayAfterStart.getDate() + 2);
      
      const eventDateStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
      
      let dateStr;
      if (eventDateStart.getTime() === todayStart.getTime()) {
        dateStr = 'today';
      } else if (eventDateStart.getTime() === tomorrowStart.getTime()) {
        dateStr = 'tomorrow';
      } else {
        dateStr = eventStart.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'America/New_York'
        });
      }
      
      const timeStr = eventStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
      });
      
      const clarificationMessage = `I understand you want to reschedule "${eventToUpdate.summary || eventToUpdate.title}" (currently scheduled for ${dateStr} at ${timeStr}). When would you like to reschedule it to?`;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: clarificationMessage
      }]);
      
      if (userSettings.tts.enabled) {
        playTextToSpeech(clarificationMessage, setIsSpeaking, userSettings);
      }
      
      // Store the event we're waiting to reschedule
      setPendingReschedule(eventToUpdate);
      
      return;
    }
  
    try {      
      let newStart = eventToUpdate.start;
      let newEnd = eventToUpdate.end;
  
      // Update time if provided
      if (updateAnalysis.newTime) {
        const newStartDate = new Date(updateAnalysis.newTime);
        const oldStart = new Date(eventToUpdate.start);
        const oldEnd = new Date(eventToUpdate.end);
        const duration = oldEnd - oldStart;
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        newStart = newStartDate.toISOString();
        newEnd = newEndDate.toISOString();
      }
  
      const updatedData = {
        summary: updateAnalysis.newTitle || eventToUpdate.summary || eventToUpdate.title,
        description: eventToUpdate.description || '',
        start: newStart,
        end: newEnd,
      };
      
      const updatedEvent = await updateCalendarEvent(googleAccessToken, eventToUpdate.id, updatedData);
      
      setCalendarEvents(prev => prev.map(e => 
        e.id === eventToUpdate.id 
          ? {
              ...e,
              title: updatedEvent.summary,
              summary: updatedEvent.summary,
              start: updatedEvent.start.dateTime || updatedEvent.start.date,
              end: updatedEvent.end.dateTime || updatedEvent.end.date
            }
          : e
      ));
  
      setRecentlyCreatedEvents(prev => prev.map(e =>
        e.id === eventToUpdate.id
          ? {
              ...e,
              summary: updatedEvent.summary,
              start: updatedEvent.start.dateTime || updatedEvent.start.date,
              end: updatedEvent.end.dateTime || updatedEvent.end.date
            }
          : e
      ));
  
      // Format the new time for the success message
      let timeStr = '';
      if (updateAnalysis.newTime) {
        const newStartDate = new Date(updateAnalysis.newTime);
        const now = new Date();
        
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const dayAfterStart = new Date(todayStart);
        dayAfterStart.setDate(dayAfterStart.getDate() + 2);
        
        const newDateStart = new Date(newStartDate.getFullYear(), newStartDate.getMonth(), newStartDate.getDate());
        
        let datePrefix = '';
        if (newDateStart.getTime() === todayStart.getTime()) {
          datePrefix = 'today at ';
        } else if (newDateStart.getTime() === tomorrowStart.getTime()) {
          datePrefix = 'tomorrow at ';
        } else {
          datePrefix = newStartDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: 'America/New_York'
          }) + ' at ';
        }
        
        const time = newStartDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          timeZone: 'America/New_York' 
        });
        
        timeStr = ` to ${datePrefix}${time}`;
      }
      
      const successMessage = `✓ I've updated "${eventToUpdate.summary || eventToUpdate.title}"${timeStr}.`;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: successMessage
      }]);
      
      if (userSettings.tts.enabled) {
        playTextToSpeech(successMessage, setIsSpeaking, userSettings);
      }
      
      // Clear pending reschedule
      setPendingReschedule(null);
      
    } catch (error) {
      console.error('Error updating event:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I had trouble updating that event: ${error.message}`
      }]);
    }
  };

  const handleTranscriptComplete = async (text) => {
    setInput('');
    await processMessage(text);
  };

  const { isRecording, toggleRecording, transcript } = useSpeechToText(handleTranscriptComplete);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Show sign-in page if not authenticated
  if (!isAuthenticated) {
    return <SignIn onSignIn={handleGoogleSignIn} />;
  }

  // Show main app if authenticated
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Header
        clearChat={() => setMessages([])}
        toggleSettings={() => {
          setShowSettings(prev => !prev);
          if (!showSettings) setShowCalendar(false);
        }}
        toggleCalendar={() => {
          setShowCalendar(prev => !prev);
          if (!showCalendar) setShowSettings(false);
        }}
        showCalendar={showCalendar}
        showSettings={showSettings}
        hasCalendarAccess={!!googleAccessToken}
      />

      {!apiConfigured && (
        <div className="bg-yellow-600 text-white p-3 text-center text-sm">
          ⚠️ API not configured. Please set up your .env file with required keys.
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          googleAccessToken={googleAccessToken}
          onSignOut={handleGoogleSignOut}
          userSettings={userSettings}
          onUpdateSettings={updateSettings}
        />
      )}

      {showCalendar && (
        <CalendarView
          googleAccessToken={googleAccessToken}
          events={calendarEvents}
          onSignIn={handleGoogleSignIn}
        />
      )}

      <MessageList 
        messages={messages} 
        loading={loading}
        isSpeaking={isSpeaking}
      />

      <InputArea
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        toggleRecording={toggleRecording}
        isRecording={isRecording}
        loading={loading}
      />
    </div>
  );
}