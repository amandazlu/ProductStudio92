import React from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';

export default function InputArea({ input, setInput, sendMessage, toggleRecording, isRecording, loading }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="p-4 bg-gray-800 border-t border-gray-700">
      <div className="max-w-3xl mx-auto flex gap-2">
        <button
          onClick={toggleRecording}
          disabled={loading}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message or use voice input..."
          disabled={loading}
          rows={1}
          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
}
