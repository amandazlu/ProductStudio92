// server/routes/userSettings.js
import express from 'express';
import {
  getUserSettings,
  saveUserSettings,
  deleteUserSettings,
  getDefaultSettings
} from '../db/schema.js';

const router = express.Router();

// GET /api/user-settings/:userEmail - Get user's settings
router.get('/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    let settings = await getUserSettings(userEmail);
    
    // If user has no settings, return defaults
    if (!settings) {
      settings = {
        userEmail,
        settings: getDefaultSettings(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
    
    res.json({ settings: settings.settings });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/user-settings/:userEmail - Save/update user's settings
router.post('/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { settings } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings data is required' });
    }
    
    // Validate settings structure
    if (!settings.tts || !settings.empathy) {
      return res.status(400).json({ 
        error: 'Invalid settings structure. Must include tts and empathy.' 
      });
    }
    
    const savedSettings = await saveUserSettings(userEmail, settings);
    
    console.log(`Settings saved for ${userEmail}:`, savedSettings.settings);
    
    res.json({ 
      success: true,
      settings: savedSettings.settings,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving user settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// DELETE /api/user-settings/:userEmail - Delete user's settings
router.delete('/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    await deleteUserSettings(userEmail);
    
    res.json({ 
      success: true,
      message: 'Settings deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user settings:', error);
    res.status(500).json({ error: 'Failed to delete settings' });
  }
});

// PATCH /api/user-settings/:userEmail - Partial update
router.patch('/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { settings: partialSettings } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    // Get existing settings
    let existing = await getUserSettings(userEmail);
    
    if (!existing) {
      // Create new if doesn't exist
      existing = {
        userEmail,
        settings: getDefaultSettings(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
    
    // Merge with partial update
    const updatedSettings = {
      ...existing.settings,
      ...partialSettings,
      tts: {
        ...existing.settings.tts,
        ...(partialSettings.tts || {})
      },
      empathy: {
        ...existing.settings.empathy,
        ...(partialSettings.empathy || {})
      }
    };
    
    const saved = await saveUserSettings(userEmail, updatedSettings);
    
    res.json({ 
      success: true,
      settings: saved.settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;