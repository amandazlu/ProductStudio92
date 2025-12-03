import { useState, useEffect } from 'react';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState('');

  // Load saved token on mount
  useEffect(() => {
    const loadSavedToken = async () => {
      try {
        const savedToken = localStorage.getItem('google_calendar_token');
        const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
        
        if (savedToken && tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry, 10);
          const now = Date.now();
          
          if (now < expiryTime) {
            console.log('Restoring saved Google Calendar token');
            setGoogleAccessToken(savedToken);
            setIsAuthenticated(true);
            return savedToken;
          } else {
            console.log('Saved token expired, clearing...');
            localStorage.removeItem('google_calendar_token');
            localStorage.removeItem('google_calendar_token_expiry');
          }
        }
      } catch (error) {
        console.error('Error loading saved token:', error);
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_calendar_token_expiry');
      }
      return null;
    };

    loadSavedToken();
  }, []);

  const saveGoogleToken = (token) => {
    setGoogleAccessToken(token);
    
    if (token) {
      localStorage.setItem('google_calendar_token', token);
      const expiryTime = Date.now() + (60 * 60 * 1000);
      localStorage.setItem('google_calendar_token_expiry', expiryTime.toString());
      console.log('Google Calendar token saved');
    } else {
      localStorage.removeItem('google_calendar_token');
      localStorage.removeItem('google_calendar_token_expiry');
      console.log('Google Calendar token cleared');
    }
  };

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
        }
      },
    });
    client.requestAccessToken();
  };

  const handleGoogleSignOut = () => {
    saveGoogleToken('');
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    googleAccessToken,
    handleGoogleSignIn,
    handleGoogleSignOut
  };
}