// server/routes/familyGroups.js - ENHANCED VERSION
import express from 'express';
import {
  getFamilyGroups,
  saveFamilyGroups,
  getInvitations,
  saveInvitations,
  getNotifications,
  saveNotifications,
  createFamilyGroup,
  createInvitation,
  createNotification,
  generateId
} from '../db/schema.js';

const router = express.Router();

// Middleware to get user email from request
function getUserEmail(req) {
  const email = req.body?.userEmail || req.query?.userEmail;
  if (!email) {
    throw new Error('User email is required');
  }
  return email;
}

// GET /api/family-groups - Get all groups for a user
router.get('/', async (req, res) => {
  try {
    const userEmail = req.query.userEmail;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail query parameter is required' });
    }
    
    const allGroups = await getFamilyGroups();
    const userGroups = allGroups.filter(group => 
      group.members.some(member => member.email === userEmail)
    );
    
    res.json({ groups: userGroups });
  } catch (error) {
    console.error('Error fetching family groups:', error);
    res.status(500).json({ error: 'Failed to fetch family groups' });
  }
});

// POST /api/family-groups - Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, description, userEmail, userName } = req.body;
    
    if (!name || !userEmail || !userName) {
      return res.status(400).json({ error: 'Name, userEmail, and userName are required' });
    }
    
    const allGroups = await getFamilyGroups();
    const newGroup = createFamilyGroup(name, description, userEmail, userName);
    
    allGroups.push(newGroup);
    await saveFamilyGroups(allGroups);
    
    res.status(201).json({ group: newGroup });
  } catch (error) {
    console.error('Error creating family group:', error);
    res.status(500).json({ error: 'Failed to create family group' });
  }
});

// PUT /api/family-groups/:groupId - Update a group
router.put('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, userEmail } = req.body;
    const allGroups = await getFamilyGroups();
    
    const groupIndex = allGroups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const group = allGroups[groupIndex];
    const member = group.members.find(m => m.email === userEmail);
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update the group' });
    }
    
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    group.updatedAt = Date.now();
    
    await saveFamilyGroups(allGroups);
    res.json({ group });
  } catch (error) {
    console.error('Error updating family group:', error);
    res.status(500).json({ error: 'Failed to update family group' });
  }
});

// DELETE /api/family-groups/:groupId - Delete a group
router.delete('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userEmail = req.body.userEmail || req.query.userEmail;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    
    const allGroups = await getFamilyGroups();
    const group = allGroups.find(g => g.id === groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const member = group.members.find(m => m.email === userEmail);
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete the group' });
    }
    
    const updatedGroups = allGroups.filter(g => g.id !== groupId);
    await saveFamilyGroups(updatedGroups);
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting family group:', error);
    res.status(500).json({ error: 'Failed to delete family group' });
  }
});

// POST /api/family-groups/:groupId/invite - Invite a member
router.post('/:groupId/invite', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { invitedEmail, userEmail } = req.body;
    
    if (!invitedEmail) {
      return res.status(400).json({ error: 'Invited email is required' });
    }
    
    const allGroups = await getFamilyGroups();
    const group = allGroups.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const member = group.members.find(m => m.email === userEmail);
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can invite members' });
    }
    
    if (group.members.some(m => m.email === invitedEmail)) {
      return res.status(400).json({ error: 'User is already a member' });
    }
    
    const allInvitations = await getInvitations();
    const existingInvitation = allInvitations.find(
      inv => inv.groupId === groupId && 
             inv.invitedEmail === invitedEmail && 
             inv.status === 'pending'
    );
    
    if (existingInvitation) {
      return res.status(400).json({ error: 'Invitation already sent' });
    }
    
    const invitation = createInvitation(groupId, group.name, userEmail, invitedEmail);
    allInvitations.push(invitation);
    await saveInvitations(allInvitations);
    
    res.status(201).json({ invitation });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /api/family-groups/invitations - Get invitations for a user
router.get('/invitations/pending', async (req, res) => {
  try {
    const userEmail = req.query.userEmail;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail query parameter is required' });
    }
    
    const allInvitations = await getInvitations();
    const userInvitations = allInvitations.filter(
      inv => inv.invitedEmail === userEmail && 
             inv.status === 'pending' &&
             inv.expiresAt > Date.now()
    );
    
    res.json({ invitations: userInvitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// POST /api/family-groups/invitations/:invitationId/accept - Accept invitation
router.post('/invitations/:invitationId/accept', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { userEmail, userName } = req.body;
    
    const allInvitations = await getInvitations();
    const invitation = allInvitations.find(inv => inv.id === invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    if (invitation.invitedEmail !== userEmail) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already processed' });
    }
    
    if (invitation.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }
    
    const allGroups = await getFamilyGroups();
    const group = allGroups.find(g => g.id === invitation.groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.members.push({
      email: userEmail,
      name: userName || userEmail.split('@')[0],
      role: 'member',
      joinedAt: Date.now(),
      notificationPreferences: {
        eventCreated: true,
        eventUpdated: true,
        eventDeleted: true,
        emailNotifications: true
      }
    });
    
    await saveFamilyGroups(allGroups);
    invitation.status = 'accepted';
    await saveInvitations(allInvitations);
    
    const allNotifications = await getNotifications();
    const notification = createNotification(
      group.id,
      'member_joined',
      userEmail,
      { memberName: userName || userEmail },
      group.members.map(m => m.email).filter(e => e !== userEmail)
    );
    allNotifications.push(notification);
    await saveNotifications(allNotifications);
    
    res.json({ group, message: 'Successfully joined the group' });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// POST /api/family-groups/invitations/:invitationId/decline - Decline invitation
router.post('/invitations/:invitationId/decline', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userEmail = getUserEmail(req);
    
    const allInvitations = await getInvitations();
    const invitation = allInvitations.find(inv => inv.id === invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    if (invitation.invitedEmail !== userEmail) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }
    
    invitation.status = 'declined';
    await saveInvitations(allInvitations);
    
    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// POST /api/family-groups/:groupId/notify - ENHANCED: Send notification with full event details
router.post('/:groupId/notify', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, eventData, userEmail } = req.body;
    
    if (!type || !eventData) {
      return res.status(400).json({ error: 'Type and eventData are required' });
    }
    
    const allGroups = await getFamilyGroups();
    const group = allGroups.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.members.some(m => m.email === userEmail)) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    
    // Get recipients based on notification preferences
    const recipients = group.members
      .filter(m => {
        if (m.email === userEmail) return false;
        
        const prefs = m.notificationPreferences;
        if (type === 'event_created') return prefs.eventCreated;
        if (type === 'event_updated') return prefs.eventUpdated;
        if (type === 'event_deleted') return prefs.eventDeleted;
        
        return true;
      })
      .map(m => m.email);
    
    if (recipients.length === 0) {
      return res.json({ message: 'No members to notify' });
    }
    
    // ENHANCED: Include full event details with formatted time/date
    const enhancedEventData = {
      ...eventData,
      eventStart: eventData.eventStart,
      eventEnd: eventData.eventEnd,
      eventLocation: eventData.eventLocation || null,
      eventDescription: eventData.eventDescription || '',
      // Format for display
      formattedDate: new Date(eventData.eventStart).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/New_York'
      }),
      formattedTime: new Date(eventData.eventStart).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
      }),
      // Add group context
      groupId: groupId,
      groupName: group.name
    };
    
    const allNotifications = await getNotifications();
    const notification = createNotification(
      groupId,
      type,
      userEmail,
      enhancedEventData,
      recipients
    );
    
    allNotifications.push(notification);
    await saveNotifications(allNotifications);
    
    res.json({ notification, message: `Notified ${recipients.length} member(s)` });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// NEW: POST /api/family-groups/notifications/:notificationId/accept-event
// Accept an event invitation from a notification
router.post('/notifications/:notificationId/accept-event', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userEmail } = req.body;
    
    const allNotifications = await getNotifications();
    const notification = allNotifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (!notification.recipients.includes(userEmail)) {
      return res.status(403).json({ error: 'This notification is not for you' });
    }
    
    // Mark notification as read
    if (!notification.readBy.includes(userEmail)) {
      notification.readBy.push(userEmail);
    }
    
    // Track acceptance
    if (!notification.acceptedBy) {
      notification.acceptedBy = [];
    }
    if (!notification.acceptedBy.includes(userEmail)) {
      notification.acceptedBy.push(userEmail);
    }
    
    await saveNotifications(allNotifications);
    
    // Return event data so the frontend can add it to the user's calendar
    res.json({ 
      message: 'Event accepted',
      eventData: notification.eventData,
      notification
    });
  } catch (error) {
    console.error('Error accepting event:', error);
    res.status(500).json({ error: 'Failed to accept event' });
  }
});

// NEW: POST /api/family-groups/notifications/:notificationId/decline-event
// Decline an event invitation from a notification
router.post('/notifications/:notificationId/decline-event', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userEmail } = req.body;
    
    const allNotifications = await getNotifications();
    const notification = allNotifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (!notification.recipients.includes(userEmail)) {
      return res.status(403).json({ error: 'This notification is not for you' });
    }
    
    // Mark notification as read
    if (!notification.readBy.includes(userEmail)) {
      notification.readBy.push(userEmail);
    }
    
    // Track decline
    if (!notification.declinedBy) {
      notification.declinedBy = [];
    }
    if (!notification.declinedBy.includes(userEmail)) {
      notification.declinedBy.push(userEmail);
    }
    
    await saveNotifications(allNotifications);
    
    res.json({ message: 'Event declined' });
  } catch (error) {
    console.error('Error declining event:', error);
    res.status(500).json({ error: 'Failed to decline event' });
  }
});

// GET /api/family-groups/notifications - Get notifications for a user
router.get('/notifications/unread', async (req, res) => {
  try {
    const userEmail = req.query.userEmail;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail query parameter is required' });
    }
    
    const allNotifications = await getNotifications();
    const userNotifications = allNotifications
      .filter(notif => 
        notif.recipients.includes(userEmail) && 
        !notif.readBy.includes(userEmail)
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
    
    res.json({ notifications: userNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/family-groups/notifications/:notificationId/read - Mark as read
router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userEmail = getUserEmail(req);
    
    const allNotifications = await getNotifications();
    const notification = allNotifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (!notification.recipients.includes(userEmail)) {
      return res.status(403).json({ error: 'This notification is not for you' });
    }
    
    if (!notification.readBy.includes(userEmail)) {
      notification.readBy.push(userEmail);
      await saveNotifications(allNotifications);
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PUT /api/family-groups/:groupId/preferences - Update notification preferences
router.put('/:groupId/preferences', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userEmail, preferences } = req.body;
    
    const allGroups = await getFamilyGroups();
    const group = allGroups.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const member = group.members.find(m => m.email === userEmail);
    if (!member) {
      return res.status(404).json({ error: 'You are not a member of this group' });
    }
    
    member.notificationPreferences = {
      ...member.notificationPreferences,
      ...preferences
    };
    
    await saveFamilyGroups(allGroups);
    
    res.json({ preferences: member.notificationPreferences });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// DELETE /api/family-groups/:groupId/members/:memberEmail - Remove member
router.delete('/:groupId/members/:memberEmail', async (req, res) => {
  try {
    const { groupId, memberEmail } = req.params;
    const userEmail = req.body.userEmail || req.query.userEmail;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    
    const allGroups = await getFamilyGroups();
    const group = allGroups.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const currentMember = group.members.find(m => m.email === userEmail);
    if (!currentMember) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    
    if (memberEmail !== userEmail && currentMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove other members' });
    }
    
    const admins = group.members.filter(m => m.role === 'admin');
    const memberToRemove = group.members.find(m => m.email === memberEmail);
    
    if (memberToRemove.role === 'admin' && admins.length === 1) {
      return res.status(400).json({ error: 'Cannot remove the last admin. Assign another admin first.' });
    }
    
    group.members = group.members.filter(m => m.email !== memberEmail);
    await saveFamilyGroups(allGroups);
    
    const allNotifications = await getNotifications();
    const notification = createNotification(
      groupId,
      'member_left',
      memberEmail,
      { memberName: memberToRemove.name },
      group.members.map(m => m.email)
    );
    allNotifications.push(notification);
    await saveNotifications(allNotifications);
    
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;