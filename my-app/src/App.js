import React, { useState } from 'react';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import MessageList from './components/MessageList';
import InputArea from './components/InputArea';
import useSpeechToText from './hooks/useSpeechToText';
import { sendMessageToOpenAI } from './services/openAI';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} from './services/googleCalendar';


export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [showSettings, setShowSettings] = useState(false);
  const { isRecording, toggleRecording, transcriptRef } = useSpeechToText();

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

  

  return (
    <div className="flex flex-col h-screen">
      <Header
        clearChat={() => setMessages([])}
        toggleSettings={() => setShowSettings(prev => !prev)}
        toggleCalendar={() => {}}
        showCalendar={false}
        showSettings={showSettings}
      />
      {showSettings && <SettingsPanel apiKey={apiKey} setApiKey={setApiKey} model={model} setModel={setModel} />}
      <MessageList messages={messages} loading={loading} />
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
