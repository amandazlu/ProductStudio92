// server/db/schema.js
// Using a simple JSON file-based approach for MVP
// For production, migrate to PostgreSQL or MongoDB

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Generic database operations
async function readDB(filename) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeDB(filename, data) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Family Groups Schema
export const FamilyGroupSchema = {
  id: 'string',
  name: 'string',
  description: 'string',
  createdBy: 'string', // user email
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  members: [
    {
      email: 'string',
      name: 'string',
      role: 'admin | member',
      joinedAt: 'timestamp',
      notificationPreferences: {
        eventCreated: 'boolean',
        eventUpdated: 'boolean',
        eventDeleted: 'boolean',
        emailNotifications: 'boolean'
      }
    }
  ]
};

// Invitations Schema
export const InvitationSchema = {
  id: 'string',
  groupId: 'string',
  groupName: 'string',
  invitedBy: 'string', // user email
  invitedEmail: 'string',
  status: 'pending | accepted | declined',
  createdAt: 'timestamp',
  expiresAt: 'timestamp'
};

// Notifications Schema
export const NotificationSchema = {
  id: 'string',
  groupId: 'string',
  type: 'event_created | event_updated | event_deleted | member_joined | member_left',
  triggeredBy: 'string', // user email
  eventData: {
    eventId: 'string',
    eventTitle: 'string',
    eventStart: 'timestamp',
    eventEnd: 'timestamp',
    changes: 'object' // for updates
  },
  recipients: ['string'], // array of emails
  createdAt: 'timestamp',
  readBy: ['string'] // array of emails who've read it
};

// Database operations
export async function getFamilyGroups() {
  return readDB('family_groups.json');
}

export async function saveFamilyGroups(groups) {
  return writeDB('family_groups.json', groups);
}

export async function getInvitations() {
  return readDB('invitations.json');
}

export async function saveInvitations(invitations) {
  return writeDB('invitations.json', invitations);
}

export async function getNotifications() {
  return readDB('notifications.json');
}

export async function saveNotifications(notifications) {
  return writeDB('notifications.json', notifications);
}

// Helper functions
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createFamilyGroup(name, description, creatorEmail, creatorName) {
  return {
    id: generateId(),
    name,
    description,
    createdBy: creatorEmail,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    members: [
      {
        email: creatorEmail,
        name: creatorName,
        role: 'admin',
        joinedAt: Date.now(),
        notificationPreferences: {
          eventCreated: true,
          eventUpdated: true,
          eventDeleted: true,
          emailNotifications: true
        }
      }
    ]
  };
}

export function createInvitation(groupId, groupName, invitedBy, invitedEmail) {
  return {
    id: generateId(),
    groupId,
    groupName,
    invitedBy,
    invitedEmail,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
}

export function createNotification(groupId, type, triggeredBy, eventData, recipients) {
  return {
    id: generateId(),
    groupId,
    type,
    triggeredBy,
    eventData,
    recipients,
    createdAt: Date.now(),
    readBy: []
  };
}


// User Settings Schema
export const UserSettingsSchema = {
  userEmail: 'string',
  settings: {
    tts: {
      enabled: 'boolean',
      voice: 'string',
      speed: 'number'
    },
    empathy: {
      level: 'string', // 'minimal' | 'balanced' | 'high'
      tone: 'string'   // 'professional' | 'friendly' | 'warm'
    }
  },
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

// Database operations for user settings
export async function getUserSettings(userEmail) {
  const settings = await readDB('user_settings.json');
  return settings.find(s => s.userEmail === userEmail) || null;
}

export async function saveUserSettings(userEmail, settingsData) {
  const allSettings = await readDB('user_settings.json');
  const existingIndex = allSettings.findIndex(s => s.userEmail === userEmail);
  
  const settingsObject = {
    userEmail,
    settings: settingsData,
    updatedAt: Date.now(),
    createdAt: existingIndex === -1 ? Date.now() : allSettings[existingIndex].createdAt
  };
  
  if (existingIndex !== -1) {
    allSettings[existingIndex] = settingsObject;
  } else {
    allSettings.push(settingsObject);
  }
  
  await writeDB('user_settings.json', allSettings);
  return settingsObject;
}

export async function deleteUserSettings(userEmail) {
  const allSettings = await readDB('user_settings.json');
  const filtered = allSettings.filter(s => s.userEmail !== userEmail);
  await writeDB('user_settings.json', filtered);
  return true;
}

// Default settings factory
export function getDefaultSettings() {
  return {
    tts: {
      enabled: true,
      voice: 'nova',
      speed: 0.95
    },
    empathy: {
      level: 'balanced',
      tone: 'professional'
    }
  };
}