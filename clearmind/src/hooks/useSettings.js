import { useState, useEffect } from 'react';

export default function useSettings() {
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

  const updateSettings = (newSettings) => {
    setUserSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  return {
    userSettings,
    updateSettings
  };
}