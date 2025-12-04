// src/components/FamilyGroups.js
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, Check, Bell, UserMinus, Mail } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
const ask = (msg) => window.confirm(msg);

export default function FamilyGroups({ userEmail, userName }) {
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  // Wrap fetch functions in useCallback to stabilize their references
  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/family-groups?userEmail=${userEmail}`);
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/family-groups/invitations/pending?userEmail=${userEmail}`);
      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  }, [userEmail]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/family-groups/notifications/unread?userEmail=${userEmail}`);
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      fetchGroups();
      fetchInvitations();
      fetchNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications();
        fetchInvitations();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [userEmail, fetchGroups, fetchInvitations, fetchNotifications]);

  const createGroup = async (name, description) => {
    try {
      const response = await fetch(`${API_BASE_URL}/family-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, userEmail, userName })
      });
      
      if (response.ok) {
        await fetchGroups();
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const acceptInvitation = async (invitationId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/family-groups/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail, userName })
        }
      );
      
      if (response.ok) {
        await fetchGroups();
        await fetchInvitations();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  const declineInvitation = async (invitationId) => {
    try {
      await fetch(
        `${API_BASE_URL}/family-groups/invitations/${invitationId}/decline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail })
        }
      );
      
      await fetchInvitations();
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await fetch(
        `${API_BASE_URL}/family-groups/notifications/${notificationId}/read`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail })
        }
      );
      
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-800">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-[82px] left-0 right-0 bottom-0 bg-gray-800 z-40 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={28} className="text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Family Groups</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
          >
            <Plus size={20} />
            Create Group
          </button>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Mail size={20} className="text-blue-400" />
              Pending Invitations
            </h3>
            <div className="space-y-2">
              {invitations.map(inv => (
                <div key={inv.id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{inv.groupName}</p>
                    <p className="text-sm text-gray-400">
                      Invited by {inv.invitedBy}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptInvitation(inv.id)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded transition flex items-center gap-1"
                    >
                      <Check size={16} />
                      Accept
                    </button>
                    <button
                      onClick={() => declineInvitation(inv.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition flex items-center gap-1"
                    >
                      <X size={16} />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unread Notifications */}
        {notifications.length > 0 && (
          <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Bell size={20} className="text-purple-400" />
              Recent Notifications ({notifications.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notifications.map(notif => (
                <NotificationItem 
                  key={notif.id} 
                  notification={notif}
                  groups={groups}
                  onMarkRead={() => markNotificationRead(notif.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Groups List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <GroupCard 
              key={group.id} 
              group={group}
              userEmail={userEmail}
              onSelect={() => setSelectedGroup(group)}
              onRefresh={fetchGroups}
            />
          ))}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No family groups yet</p>
            <p className="text-sm">Create a group to coordinate schedules with family members</p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal 
          onClose={() => setShowCreateModal(false)}
          onCreate={createGroup}
        />
      )}

      {/* Group Details Modal */}
      {selectedGroup && (
        <GroupDetailsModal
          group={selectedGroup}
          userEmail={userEmail}
          onClose={() => setSelectedGroup(null)}
          onRefresh={fetchGroups}
        />
      )}
    </div>
  );
}

function GroupCard({ group, userEmail, onSelect, onRefresh }) {
  const isAdmin = group.members.find(m => m.email === userEmail)?.role === 'admin';
  
  return (
    <div 
      onClick={onSelect}
      className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition cursor-pointer border-2 border-transparent hover:border-purple-500"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-lg">{group.name}</h3>
        {isAdmin && (
          <span className="text-xs px-2 py-1 bg-purple-600 rounded">Admin</span>
        )}
      </div>
      
      {group.description && (
        <p className="text-sm text-gray-400 mb-3">{group.description}</p>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
        <span className="text-xs">
          Created {new Date(group.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), description.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Create Family Group</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Group Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Smith Family Care Team"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group for?"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows="3"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GroupDetailsModal({ group, userEmail, onClose, onRefresh }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  
  const currentMember = group.members.find(m => m.email === userEmail);
  const isAdmin = currentMember?.role === 'admin';

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/family-groups/${group.id}/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitedEmail: inviteEmail.trim(), userEmail })
        }
      );
      
      if (response.ok) {
        setInviteEmail('');
        setShowInvite(false);
        alert('Invitation sent!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      alert('Failed to send invitation');
    }
  };

  const handleRemoveMember = async (memberEmail) => {
    if (!ask(`Remove ${memberEmail} from the group?`)) return;
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/family-groups/${group.id}/members/${memberEmail}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail })
        }
      );
      
      if (response.ok) {
        await onRefresh();
        if (memberEmail === userEmail) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const updatePreferences = async (preferences) => {
    try {
      await fetch(
        `${API_BASE_URL}/family-groups/${group.id}/preferences`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail, preferences })
        }
      );
      await onRefresh();
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{group.name}</h3>
              {group.description && (
                <p className="text-sm text-gray-400 mt-1">{group.description}</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-2 px-1 ${activeTab === 'members' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-400'}`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-2 px-1 ${activeTab === 'settings' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-400'}`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Invite Button */}
              {isAdmin && !showInvite && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Mail size={20} />
                  Invite Member
                </button>
              )}

              {/* Invite Form */}
              {showInvite && (
                <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full bg-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowInvite(false)}
                      className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                    >
                      Send Invite
                    </button>
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                {group.members.map(member => (
                  <div key={member.email} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-400">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        member.role === 'admin' ? 'bg-purple-600' : 'bg-gray-600'
                      }`}>
                        {member.role}
                      </span>
                      {(isAdmin || member.email === userEmail) && (
                        <button
                          onClick={() => handleRemoveMember(member.email)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title={member.email === userEmail ? 'Leave group' : 'Remove member'}
                        >
                          <UserMinus size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && currentMember && (
            <div className="space-y-4">
              <h4 className="font-semibold mb-3">Notification Preferences</h4>
              
              <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer">
                <span>Event Created</span>
                <input
                  type="checkbox"
                  checked={currentMember.notificationPreferences.eventCreated}
                  onChange={(e) => updatePreferences({ eventCreated: e.target.checked })}
                  className="w-5 h-5 accent-purple-600"
                />
              </label>
              
              <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer">
                <span>Event Updated</span>
                <input
                  type="checkbox"
                  checked={currentMember.notificationPreferences.eventUpdated}
                  onChange={(e) => updatePreferences({ eventUpdated: e.target.checked })}
                  className="w-5 h-5 accent-purple-600"
                />
              </label>
              
              <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer">
                <span>Event Deleted</span>
                <input
                  type="checkbox"
                  checked={currentMember.notificationPreferences.eventDeleted}
                  onChange={(e) => updatePreferences({ eventDeleted: e.target.checked })}
                  className="w-5 h-5 accent-purple-600"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationItem({ notification, groups, onMarkRead }) {
  const group = groups.find(g => g.id === notification.groupId);
  const groupName = group?.name || 'Unknown Group';
  
  const getNotificationMessage = () => {
    const { type, eventData, triggeredBy } = notification;
    const sender = triggeredBy.split('@')[0];
    
    switch (type) {
      case 'event_created':
        return `${sender} created "${eventData.eventTitle}" in ${groupName}`;
      case 'event_updated':
        return `${sender} updated "${eventData.eventTitle}" in ${groupName}`;
      case 'event_deleted':
        return `${sender} deleted "${eventData.eventTitle}" from ${groupName}`;
      case 'member_joined':
        return `${eventData.memberName} joined ${groupName}`;
      case 'member_left':
        return `${eventData.memberName} left ${groupName}`;
      default:
        return `New activity in ${groupName}`;
    }
  };

  return (
    <div className="bg-gray-700 rounded-lg p-3 flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm">{getNotificationMessage()}</p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(notification.createdAt).toLocaleString()}
        </p>
      </div>
      <button
        onClick={onMarkRead}
        className="text-purple-400 hover:text-purple-300 p-1"
        title="Mark as read"
      >
        <Check size={18} />
      </button>
    </div>
  );
}