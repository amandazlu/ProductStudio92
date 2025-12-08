// src/components/FamilyGroupNotifications.js
import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Check, X, ChevronDown, ChevronUp, User } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

export default function FamilyGroupNotifications({ 
  notifications, 
  groups, 
  userEmail,
  googleAccessToken,
  onAcceptEvent, 
  onDeclineEvent,
  onMarkRead,
  onRefresh 
}) {
  const [expandedNotification, setExpandedNotification] = useState(null);
  const [processingNotification, setProcessingNotification] = useState(null);

  const toggleExpanded = (notificationId) => {
    setExpandedNotification(expandedNotification === notificationId ? null : notificationId);
  };

  const handleAcceptEvent = async (notification) => {
    setProcessingNotification(notification.id);
    
    try {
      // 1. Mark as accepted in the backend
      const response = await fetch(
        `${API_BASE_URL}/family-groups/notifications/${notification.id}/accept-event`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to accept event');
      }
      
      const data = await response.json();
      
      // 2. Add event to user's calendar using the callback
      if (onAcceptEvent && googleAccessToken) {
        await onAcceptEvent(data.eventData, googleAccessToken);
      }
      
      // 3. Refresh notifications
      if (onRefresh) {
        await onRefresh();
      }
      
    } catch (error) {
      console.error('Error accepting event:', error);
      alert('Failed to accept event. Please try again.');
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleDeclineEvent = async (notification) => {
    setProcessingNotification(notification.id);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/family-groups/notifications/${notification.id}/decline-event`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to decline event');
      }
      
      // Call the decline callback if provided
      if (onDeclineEvent) {
        await onDeclineEvent(notification);
      }
      
      // Refresh notifications
      if (onRefresh) {
        await onRefresh();
      }
      
    } catch (error) {
      console.error('Error declining event:', error);
      alert('Failed to decline event. Please try again.');
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleMarkRead = async (notification) => {
    if (onMarkRead) {
      await onMarkRead(notification.id);
    }
  };

  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {notifications.map(notification => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          groups={groups}
          userEmail={userEmail}
          isExpanded={expandedNotification === notification.id}
          isProcessing={processingNotification === notification.id}
          onToggleExpand={() => toggleExpanded(notification.id)}
          onAccept={() => handleAcceptEvent(notification)}
          onDecline={() => handleDeclineEvent(notification)}
          onMarkRead={() => handleMarkRead(notification)}
        />
      ))}
    </div>
  );
}

function NotificationCard({ 
  notification, 
  groups, 
  userEmail,
  isExpanded, 
  isProcessing,
  onToggleExpand, 
  onAccept, 
  onDecline,
  onMarkRead 
}) {
  const group = groups.find(g => g.id === notification.groupId);
  const groupName = group?.name || 'Unknown Group';
  
  const { type, eventData, triggeredBy } = notification;
  const senderName = triggeredBy.split('@')[0];
  
  // Check if this user has already responded
  const hasAccepted = notification.acceptedBy?.includes(userEmail);
  const hasDeclined = notification.declinedBy?.includes(userEmail);
  const hasResponded = hasAccepted || hasDeclined;
  
  const isEventNotification = ['event_created', 'event_updated', 'event_deleted'].includes(type);
  
  const getNotificationIcon = () => {
    switch (type) {
      case 'event_created':
        return <Calendar size={20} className="text-green-400" />;
      case 'event_updated':
        return <Calendar size={20} className="text-blue-400" />;
      case 'event_deleted':
        return <Calendar size={20} className="text-red-400" />;
      case 'member_joined':
        return <User size={20} className="text-purple-400" />;
      case 'member_left':
        return <User size={20} className="text-gray-400" />;
      default:
        return <Calendar size={20} className="text-gray-400" />;
    }
  };
  
  const getNotificationTitle = () => {
    switch (type) {
      case 'event_created':
        return `${senderName} created an event`;
      case 'event_updated':
        return `${senderName} updated an event`;
      case 'event_deleted':
        return `${senderName} deleted an event`;
      case 'member_joined':
        return `${eventData.memberName} joined ${groupName}`;
      case 'member_left':
        return `${eventData.memberName} left ${groupName}`;
      default:
        return 'New activity';
    }
  };

  return (
    <div className={`bg-gray-700 rounded-lg border-2 transition-all ${
      hasResponded 
        ? 'border-gray-600 opacity-75' 
        : 'border-purple-500/50 hover:border-purple-500'
    }`}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1">{getNotificationIcon()}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-white">{getNotificationTitle()}</h4>
                {hasAccepted && (
                  <span className="text-xs px-2 py-0.5 bg-green-600 rounded">Accepted</span>
                )}
                {hasDeclined && (
                  <span className="text-xs px-2 py-0.5 bg-red-600 rounded">Declined</span>
                )}
              </div>
              
              {isEventNotification && eventData && (
                <div className="text-sm text-gray-300 space-y-1">
                  <div className="font-semibold">{eventData.eventTitle}</div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {eventData.formattedDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {eventData.formattedTime}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-400 mt-2">
                {new Date(notification.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          
          <button className="text-gray-400 hover:text-white ml-2">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-600 pt-4">
          {isEventNotification && eventData && (
            <div className="space-y-3 mb-4">
              {/* Event Details */}
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div>
                  <label className="text-xs text-gray-400">Event</label>
                  <div className="text-sm font-medium">{eventData.eventTitle}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Date</label>
                    <div className="text-sm">{eventData.formattedDate}</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Time</label>
                    <div className="text-sm">{eventData.formattedTime}</div>
                  </div>
                </div>
                
                {eventData.eventLocation && (
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={12} />
                      Location
                    </label>
                    <div className="text-sm">{eventData.eventLocation}</div>
                  </div>
                )}
                
                {eventData.eventDescription && (
                  <div>
                    <label className="text-xs text-gray-400">Description</label>
                    <div className="text-sm text-gray-300">{eventData.eventDescription}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons - Only show for created events that haven't been responded to */}
              {type === 'event_created' && !hasResponded && (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept();
                    }}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    {isProcessing ? 'Adding...' : 'Add to My Calendar'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDecline();
                    }}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    Decline
                  </button>
                </div>
              )}

              {/* Response Status */}
              {notification.acceptedBy && notification.acceptedBy.length > 0 && (
                <div className="text-xs text-gray-400">
                  <span className="text-green-400">✓</span> Accepted by: {notification.acceptedBy.length} member(s)
                </div>
              )}
              {notification.declinedBy && notification.declinedBy.length > 0 && (
                <div className="text-xs text-gray-400">
                  <span className="text-red-400">✗</span> Declined by: {notification.declinedBy.length} member(s)
                </div>
              )}
            </div>
          )}

          {/* Mark as Read Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="text-xs text-purple-400 hover:text-purple-300 transition"
          >
            Mark as read
          </button>
        </div>
      )}
    </div>
  );
}