import React, { useState, useEffect } from 'react';
import Header from './components/Header.js';
import SettingsPanel from './components/SettingsPanel.js';
import MessageList from './components/MessageList.js';
import InputArea from './components/InputArea.js';
import CalendarView from './components/CalendarView.js';
import SignIn from './components/SignIn.js';
import useSpeechToText from './hooks/useSpeechToText.js';
import useAuth from './hooks/useAuth.js';
import useSettings from './hooks/useSettings.js';
import useCalendarEvents from './hooks/useCalendarEvents.js';
import useMessageProcessing from './hooks/useMessageProcessing.js';
import FamilyGroups from './components/FamilyGroups.js';

export default function App() {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFamilyGroups, setShowFamilyGroups] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);

  const { isAuthenticated, googleAccessToken, userEmail, userName, handleGoogleSignIn, handleGoogleSignOut } = useAuth();
  const { userSettings, updateSettings } = useSettings();
  const { 
    calendarEvents, 
    setCalendarEvents, 
    recentlyCreatedEvents, 
    setRecentlyCreatedEvents 
  } = useCalendarEvents(googleAccessToken);
  
  const { messages, setMessages, loading, processMessage } = useMessageProcessing({
    googleAccessToken,
    calendarEvents,
    setCalendarEvents,
    recentlyCreatedEvents,
    setRecentlyCreatedEvents,
    userSettings,
    isSpeaking,
    setIsSpeaking
  });

  useEffect(() => {
    setApiConfigured(!!process.env.REACT_APP_API_BASE_URL);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await processMessage(input);
    setInput('');
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

  if (!isAuthenticated) {
    return <SignIn onSignIn={handleGoogleSignIn} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Header
        clearChat={() => setMessages([])}
        toggleSettings={() => {
          setShowSettings(prev => !prev);
          if (!showSettings) {
            setShowCalendar(false);
            setShowFamilyGroups(false);
          }
        }}
        toggleCalendar={() => {
          setShowCalendar(prev => !prev);
          if (!showCalendar) {
            setShowFamilyGroups(false);
            setShowSettings(false);
          } 
        }}
        toggleFamilyGroups={() => {
          setShowFamilyGroups(prev => !prev);
          if (!showFamilyGroups) {
            setShowSettings(false);
            setShowCalendar(false);
          }
        }}
        showFamilyGroups={showFamilyGroups}
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

      {showFamilyGroups && (
        <FamilyGroups
          userEmail={userEmail} // Get from your auth system
          userName={userName}   // Get from your auth system
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