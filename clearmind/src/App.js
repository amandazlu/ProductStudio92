import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import MessageList from './components/MessageList';
import InputArea from './components/InputArea';
import CalendarView from './components/CalendarView';
import useSpeechToText from './hooks/useSpeechToText';
import RecordButton from './components/RecordButton';
import { sendMessageToOpenAI } from './services/openAI';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} from './services/googleCalendar';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [showSettings, setShowSettings] = useState(false);

  // Google Calendar-related states
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // 🗓️ Google Sign-In (kept local because it handles UI token logic)
  const handleGoogleSignIn = () => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar',
      callback: async (response) => {
        if (response.access_token) {
          setGoogleAccessToken(response.access_token);
          setLoadingEvents(true);
          const events = await fetchCalendarEvents(response.access_token);
          setCalendarEvents(events || []);
          setLoadingEvents(false);
        }
      },
    });
    client.requestAccessToken();
  };

  // Chat send
  const sendMessage = async () => {
    if (!input.trim() || !apiKey) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const assistantMessage = await sendMessageToOpenAI([...messages, userMessage], apiKey, model);
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Calendar handlers
  // Add new event
  const handleAddEvent = async (eventData) => {
    if (!googleAccessToken) return alert('Sign in first');
    const newEvent = await createCalendarEvent(googleAccessToken, eventData);
    return newEvent; // <-- return so CalendarView can update state
  };

  // Update event: TODO
  const handleUpdateEvent = async (eventId, updatedData) => {
    await updateCalendarEvent(googleAccessToken, eventId, updatedData);
    const updatedEvents = await fetchCalendarEvents(googleAccessToken);
    setCalendarEvents(updatedEvents);
  };

  // Delete event
  const handleDeleteEvent = async (eventId) => {
    try {
      await deleteCalendarEvent(googleAccessToken, eventId);
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event');
    }
  };

   // Callback for when speech is transcribed
   const handleTranscriptComplete = async (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    try {
      // Send text to backend AI processing
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/processSpeech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const eventData = await response.json();

      // Automatically create event in Google Calendar
      if (googleAccessToken && eventData) {
        const created = await createCalendarEvent(googleAccessToken, eventData);
        // Update local calendar immediately
        setCalendarEvents(prev => [
          ...prev,
          {
            id: created.id,
            title: created.summary,
            description: created.description,
            start: new Date(created.start.dateTime || created.start.date),
            end: new Date(created.end.dateTime || created.end.date)
          }
        ]);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Event created in your calendar!' }]);
      }
    } catch (err) {
      console.error('Error processing transcript:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to create event.' }]);
    }
  };


  const { isRecording, toggleRecording, transcript } = useSpeechToText(handleTranscriptComplete);
  useEffect(() => {
    if (transcript) {
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    }
  }, [transcript]);

  return (
    <div className="flex flex-col h-screen">
      <Header
        clearChat={() => setMessages([])}
        toggleSettings={() => setShowSettings(prev => !prev)}
        toggleCalendar={() => setShowCalendar(prev => !prev)}
        showCalendar={showCalendar}
        showSettings={showSettings}
      />

      {showSettings && (
        <SettingsPanel
          apiKey={apiKey}
          setApiKey={setApiKey}
          model={model}
          setModel={setModel}
        />
      )}

      {showCalendar && (
        <div className="p-4 bg-gray-100 border-t border-gray-300 overflow-y-auto">
          {!googleAccessToken ? (
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={handleGoogleSignIn}
            >
              Sign in to Google Calendar
            </button>
          ) : (
            <CalendarView
              googleAccessToken={googleAccessToken}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          )}
        </div>
      )}

      <MessageList messages={messages} loading={loading} />
      {/* <RecordButton onTranscribed={(text) => setInput(text)} /> */}
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
