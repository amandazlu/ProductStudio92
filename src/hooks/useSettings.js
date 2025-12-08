// src/hooks/useSettings.js
import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const DEFAULT_SETTINGS = {
  tts: {
    enabled: true,
    voice: 'nova',
    speed: 0.95,
  },
  empathy: {
    level: 'balanced',
    tone: 'professional',
  }
};

export default function useSettings(userEmail) {
  const [userSettings, setUserSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Load settings from database when user signs in
  const loadSettingsFromDatabase = useCallback(async (email) => {
    if (!email) {
      console.log('No user email - using default settings');
      setUserSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    try {
      console.log('Loading settings from database for:', email);
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/user-settings/${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load settings from database');
      }

      const data = await response.json();
      
      console.log('Settings loaded from database:', data.settings);
      setUserSettings(data.settings);
      setLastSyncTime(new Date());
      
      // Also cache in sessionStorage for quick access
      sessionStorage.setItem('clearmind_settings_cache', JSON.stringify(data.settings));
      
    } catch (error) {
      console.error('Error loading settings from database:', error);
      
      // Fallback to sessionStorage cache if database fails
      const cached = sessionStorage.getItem('clearmind_settings_cache');
      if (cached) {
        console.log('Using cached settings');
        setUserSettings(JSON.parse(cached));
      } else {
        console.log('Using default settings');
        setUserSettings(DEFAULT_SETTINGS);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load settings when userEmail changes
  useEffect(() => {
    loadSettingsFromDatabase(userEmail);
  }, [userEmail, loadSettingsFromDatabase]);

  // Save settings to database (debounced)
  const saveSettingsToDatabase = useCallback(async (email, settings) => {
    if (!email) {
      console.log('No user email - settings not saved to database');
      return;
    }

    try {
      setIsSaving(true);
      console.log('Saving settings to database for:', email);

      const response = await fetch(
        `${API_BASE_URL}/user-settings/${encodeURIComponent(email)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settings }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save settings to database');
      }

      const data = await response.json();
      console.log('Settings saved successfully:', data.message);
      setLastSyncTime(new Date());
      
      // Update cache
      sessionStorage.setItem('clearmind_settings_cache', JSON.stringify(settings));
      
    } catch (error) {
      console.error('Error saving settings to database:', error);
      // Settings are still in memory, user can continue using the app
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced save - wait 1 second after last change before saving
  useEffect(() => {
    if (!userEmail) return;

    const timeoutId = setTimeout(() => {
      saveSettingsToDatabase(userEmail, userSettings);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [userSettings, userEmail, saveSettingsToDatabase]);

  const updateSettings = useCallback((newSettings) => {
    setUserSettings(prev => {
      const updated = {
        ...prev,
        ...newSettings,
        tts: {
          ...prev.tts,
          ...(newSettings.tts || {})
        },
        empathy: {
          ...prev.empathy,
          ...(newSettings.empathy || {})
        }
      };
      return updated;
    });
  }, []);

  // Force sync with database (useful for "refresh" button)
  const syncWithDatabase = useCallback(async () => {
    if (!userEmail) return;
    await loadSettingsFromDatabase(userEmail);
  }, [userEmail, loadSettingsFromDatabase]);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    setUserSettings(DEFAULT_SETTINGS);
    if (userEmail) {
      await saveSettingsToDatabase(userEmail, DEFAULT_SETTINGS);
    }
  }, [userEmail, saveSettingsToDatabase]);

  return {
    userSettings,
    updateSettings,
    isLoading,
    isSaving,
    lastSyncTime,
    syncWithDatabase,
    resetToDefaults
  };
}