import React from 'react';
import { Trash2, Settings, Calendar } from 'lucide-react';

export default function Header({ clearChat, toggleSettings, toggleCalendar, showCalendar, showSettings }) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          ClearMind AI
        </h1>
        <div className="flex gap-2">
          <button onClick={toggleCalendar} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600" title="Calendar">
            <Calendar size={20} />
          </button>
          <button onClick={clearChat} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600" title="Clear chat">
            <Trash2 size={20} />
          </button>
          <button onClick={toggleSettings} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600" title="Settings">
            <Settings size={20} />
          </button>
        </div>
      </div>
    );
  }
  
