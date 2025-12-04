import { useState, useEffect } from 'react';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Load saved token on mount
  useEffect(() => {
    const loadSavedToken = async () => {
      try {
        const savedToken = localStorage.getItem('google_calendar_token');
        const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
        const savedEmail = localStorage.getItem('user_email');
        const savedName = localStorage.getItem('user_name');
        
        if (savedToken && tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry, 10);
          const now = Date.now();
          
          if (now < expiryTime) {
            console.log('Restoring saved Google Calendar token');
            setGoogleAccessToken(savedToken);
            setIsAuthenticated(true);
            
            // FIX: Restore user info from localStorage
            if (savedEmail) {
              setUserEmail(savedEmail);
              console.log('Restored user email:', savedEmail);
            }
            if (savedName) {
              setUserName(savedName);
              console.log('Restored user name:', savedName);
            }
            
            return savedToken;
          } else {
            console.log('Saved token expired, clearing...');
            localStorage.removeItem('google_calendar_token');
            localStorage.removeItem('google_calendar_token_expiry');
            localStorage.removeItem('user_email');
            localStorage.removeItem('user_name');
          }
        }
      } catch (error) {
        console.error('Error loading saved token:', error);
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_calendar_token_expiry');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
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
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      callback: async (response) => {
        if (response.access_token) {
          saveGoogleToken(response.access_token);
          setIsAuthenticated(true);
          
          // Fetch user info
          try {
            const userInfoResponse = await fetch(
              'https://www.googleapis.com/oauth2/v2/userinfo',
              {
                headers: {
                  Authorization: `Bearer ${response.access_token}`
                }
              }
            );
            const userInfo = await userInfoResponse.json();
            setUserEmail(userInfo.email);
            setUserName(userInfo.name);
            localStorage.setItem('user_email', userInfo.email);
            localStorage.setItem('user_name', userInfo.name);
            console.log('User info saved:', { email: userInfo.email, name: userInfo.name });
          } catch (error) {
            console.error('Error fetching user info:', error);
          }
        }
      },
    });
    client.requestAccessToken();
  };

  const handleGoogleSignOut = () => {
    saveGoogleToken('');
    setIsAuthenticated(false);
    setUserEmail('');
    setUserName('');
    // FIX: Also clear user info from localStorage on sign out
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
  };

  return {
    isAuthenticated,
    googleAccessToken,
    userEmail,
    userName,
    handleGoogleSignIn,
    handleGoogleSignOut
  };
}