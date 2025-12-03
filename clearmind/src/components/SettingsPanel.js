import React, { useState } from 'react';
import { Check, X, Volume2, Heart, ChevronDown, ChevronUp } from 'lucide-react';

export default function SettingsPanel({ 
  googleAccessToken, 
  onSignOut,
  userSettings,
  onUpdateSettings
}) {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleTTSChange = (key, value) => {
    onUpdateSettings({
      ...userSettings,
      tts: {
        ...userSettings.tts,
        [key]: value
      }
    });
  };

  const handleEmpathyChange = (key, value) => {
    onUpdateSettings({
      ...userSettings,
      empathy: {
        ...userSettings.empathy,
        [key]: value
      }
    });
  };

  // Test TTS with current settings
  const testVoice = async () => {
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
      
      const response = await fetch(`${apiBaseUrl}/speech/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: "Hello! This is how I'll sound with your current settings.",
          voice: userSettings.tts.voice,
          speed: userSettings.tts.speed
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to generate test audio');
      }
  
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error testing voice:', error);
      alert('Failed to test voice. Please check your API connection.');
    }
  };

  return (
    <div className="absolute top-[82px] left-0 right-0 bottom-0 bg-gray-800 z-40 overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-bold mb-4">Settings</h2>

        {/* Text-to-Speech Settings */}
        <div className="bg-gray-700 rounded-lg p-4">
          <button
            onClick={() => toggleSection('tts')}
            className="w-full flex items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <Volume2 size={20} />
              <span className="font-semibold">Text-to-Speech</span>
            </div>
            {expandedSection === 'tts' ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>

          {expandedSection === 'tts' && (
            <div className="space-y-4 mt-4">
              {/* Enable/Disable TTS */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Enable voice responses</label>
                <button
                  onClick={() => handleTTSChange('enabled', !userSettings.tts.enabled)}
                  className={`w-12 h-6 rounded-full transition relative ${
                    userSettings.tts.enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition transform absolute top-0.5 ${
                      userSettings.tts.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Voice Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Voice Style
                </label>
                <select
                  value={userSettings.tts.voice}
                  onChange={(e) => handleTTSChange('voice', e.target.value)}
                  className="w-full bg-gray-600 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={!userSettings.tts.enabled}
                >
                  <option value="nova">Nova (Default - Balanced)</option>
                  <option value="alloy">Alloy (Neutral)</option>
                  <option value="echo">Echo (Warm)</option>
                  <option value="fable">Fable (Expressive)</option>
                  <option value="onyx">Onyx (Deep)</option>
                  <option value="shimmer">Shimmer (Bright)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Choose the voice that feels most comfortable to you
                </p>
              </div>

              {/* Speed Control */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Speech Speed: {userSettings.tts.speed.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={userSettings.tts.speed}
                  onChange={(e) => handleTTSChange('speed', parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                  disabled={!userSettings.tts.enabled}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Slower</span>
                  <span>Faster</span>
                </div>
              </div>

              {/* Test Button */}
              <button
                onClick={testVoice}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
                disabled={!userSettings.tts.enabled}
              >
                Test Voice
              </button>
            </div>
          )}
        </div>

        {/* Empathy & Tone Settings */}
        <div className="bg-gray-700 rounded-lg p-4">
          <button
            onClick={() => toggleSection('empathy')}
            className="w-full flex items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <Heart size={20} />
              <span className="font-semibold">Empathy & Tone</span>
            </div>
            {expandedSection === 'empathy' ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>

          {expandedSection === 'empathy' && (
            <div className="space-y-4 mt-4">
              {/* Empathy Level */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Empathy Level
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'minimal', label: 'Minimal', desc: 'Direct and concise' },
                    { value: 'balanced', label: 'Balanced', desc: 'Supportive yet efficient' },
                    { value: 'high', label: 'High', desc: 'Very understanding and warm' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleEmpathyChange('level', option.value)}
                      className={`w-full p-3 rounded-lg text-left transition ${
                        userSettings.empathy.level === option.value
                          ? 'bg-purple-600 border-2 border-purple-400'
                          : 'bg-gray-600 hover:bg-gray-500 border-2 border-transparent'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-300">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone Style */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Conversation Tone
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'professional', label: 'Professional', desc: 'Clear and respectful' },
                    { value: 'friendly', label: 'Friendly', desc: 'Casual and approachable' },
                    { value: 'warm', label: 'Warm', desc: 'Caring and personal' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleEmpathyChange('tone', option.value)}
                      className={`w-full p-3 rounded-lg text-left transition ${
                        userSettings.empathy.tone === option.value
                          ? 'bg-purple-600 border-2 border-purple-400'
                          : 'bg-gray-600 hover:bg-gray-500 border-2 border-transparent'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-300">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Example Preview */}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                <p className="text-xs text-gray-400 mb-2">Example response:</p>
                <p className="text-sm text-gray-200 italic">
                  {getExampleResponse(userSettings.empathy.level, userSettings.empathy.tone)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Google Calendar Section */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Google Calendar</span>
              {googleAccessToken ? (
                <Check size={18} className="text-green-400" />
              ) : (
                <X size={18} className="text-red-400" />
              )}
            </div>
          </div>
          <p className="text-sm text-gray-300 mt-2">
            {googleAccessToken 
              ? '✓ Connected to Google Calendar' 
              : 'Calendar integration not connected'}
          </p>
        </div>

        {/* Account Section */}
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Account</h3>
          <button
            onClick={onSignOut}
            className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg transition-all text-white shadow-md"
          >
            Sign Out
          </button>
          <p className="text-xs text-gray-400 mt-2">
            This will sign you out and clear all your data
          </p>
        </div>

        {/* About Section */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="font-semibold mb-2">About ClearMind AI</h3>
          <p className="text-sm text-gray-300">
            Your AI assistant designed specifically for the Sandwich Generation - 
            helping you manage care for aging parents while raising your own children.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Version 1.0.0 • Built with empathy
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to generate example responses
function getExampleResponse(level, tone) {
  const examples = {
    minimal: {
      professional: "I understand you're managing multiple responsibilities. What would help most right now?",
      friendly: "Sounds like you've got a lot going on. What can I help with?",
      warm: "I hear you - that's a lot to juggle. How can I support you?"
    },
    balanced: {
      professional: "Managing care for both generations is challenging. I'm here to help you organize and find solutions. What's most pressing?",
      friendly: "That sounds really overwhelming, friend. Let's tackle this together - what's the biggest thing on your plate?",
      warm: "Your feelings are completely valid. Caring for both parents and children is exhausting. Let's work through this together."
    },
    high: {
      professional: "I truly understand how difficult it is to balance care for your parents and children simultaneously. Your dedication is admirable, and you're doing better than you think. What aspect would you like support with?",
      friendly: "Oh wow, I can really feel how much you're carrying right now. You're doing an amazing job, even when it doesn't feel like it. What would help lighten the load today?",
      warm: "I'm so sorry you're feeling this way. Being pulled in different directions by the people you love most is incredibly hard. Please know you're not alone, and it's okay to ask for help. What do you need right now?"
    }
  };

  return examples[level][tone];
}