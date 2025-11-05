import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import MessageList from './components/MessageList';
import InputArea from './components/InputArea';
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

  const { isRecording, toggleRecording, transcript } = useSpeechToText();

  useEffect(() => {
    if (transcript) {
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    }
  }, [transcript]);

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

  // 🗓️ Example wrapper to add new events (calls your service)
  const handleAddEvent = async (eventData) => {
    if (!googleAccessToken) {
      alert('Please sign in to Google Calendar first');
      return;
    }
    await createCalendarEvent(googleAccessToken, eventData);
    const updatedEvents = await fetchCalendarEvents(googleAccessToken);
    setCalendarEvents(updatedEvents);
  };

  const handleDeleteEvent = async (eventId) => {
    await deleteCalendarEvent(googleAccessToken, eventId);
    const updatedEvents = await fetchCalendarEvents(googleAccessToken);
    setCalendarEvents(updatedEvents);
  };

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
            <>
              <h2 className="text-lg font-semibold mb-2">Upcoming Events</h2>
              {loadingEvents ? (
                <p>Loading events...</p>
              ) : (
                <ul>
                  {calendarEvents.map(event => (
                    <li
                      key={event.id}
                      className="border-b py-2 flex justify-between items-center"
                    >
                      <span>{event.summary || '(No Title)'}</span>
                      <button
                        className="text-red-500 text-sm"
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
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
