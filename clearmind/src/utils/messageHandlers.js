import { 
    createCalendarEvent, 
    updateCalendarEvent, 
    deleteCalendarEvent, 
  } from '../services/googleCalendar.js';
  import { playTextToSpeech } from '../services/ttsService.js';
  
  export async function handleMultipleEventsCreation(
    eventsData,
    googleAccessToken,
    setCalendarEvents,
    setMessages
  ) {
    try {
      let successCount = 0;
      let failCount = 0;
      const createdEventsList = [];
  
      for (const eventData of eventsData) {
        try {
          const createdEvent = await createCalendarEvent(googleAccessToken, eventData);
          
          const eventObj = {
            id: createdEvent.id,
            title: createdEvent.summary,
            summary: createdEvent.summary,
            description: createdEvent.description,
            start: createdEvent.start.dateTime || createdEvent.start.date,
            end: createdEvent.end.dateTime || createdEvent.end.date
          };
          
          setCalendarEvents(prev => [...prev, eventObj]);
          createdEventsList.push(eventObj);
          
          successCount++;
        } catch (error) {
          console.error('Error creating individual event:', error);
          failCount++;
        }
      }
  
      if (successCount > 0 && failCount === 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✓ All ${successCount} event${successCount > 1 ? 's' : ''} added to your calendar!` 
        }]);
      } else if (successCount > 0 && failCount > 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✓ ${successCount} event${successCount > 1 ? 's' : ''} added. ${failCount} failed to create.` 
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I had trouble adding those to your calendar. Please try again.'
        }]);
      }
  
      return createdEventsList;
  
    } catch (error) {
      console.error('Error creating multiple events:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble adding those to your calendar. Please try again.'
      }]);
      return [];
    }
  }
  
  export async function handleEventDeletion(
    event,
    googleAccessToken,
    setCalendarEvents,
    setMessages
  ) {
    if (!googleAccessToken || !event || !event.id) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I couldn\'t delete that event. Please try again.'
      }]);
      return;
    }
  
    try {
      await deleteCalendarEvent(googleAccessToken, event.id);
      
      setCalendarEvents(prev => prev.filter(e => e.id !== event.id));
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✓ I've deleted "${event.title}" from your calendar.`
      }]);
      
    } catch (error) {
      console.error('Error deleting event:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble deleting that event. Please try again.'
      }]);
    }
  }
  
  export async function handleEventUpdate(
    updateAnalysis,
    eventToUpdate,
    googleAccessToken,
    userSettings,
    setMessages,
    setCalendarEvents,
    setRecentlyCreatedEvents,
    setPendingReschedule,
    isSpeaking,
    setIsSpeaking
  ) {
    if (!googleAccessToken || !eventToUpdate) {
      setMessages(prev => prev.filter(m => !m.isTemporary));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I couldn\'t update that event. Please try again.'
      }]);
      return;
    }
  
    // Check if we have enough information to update
    if (!updateAnalysis.newTime && !updateAnalysis.newDate && !updateAnalysis.newTitle) {
      console.log('Not enough info to update - asking for clarification');
      
      setMessages(prev => prev.filter(m => !m.isTemporary));
      
      const eventStart = new Date(eventToUpdate.start);
      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      
      const eventDateStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
      
      let dateStr;
      if (eventDateStart.getTime() === todayStart.getTime()) {
        dateStr = 'today';
      } else if (eventDateStart.getTime() === tomorrowStart.getTime()) {
        dateStr = 'tomorrow';
      } else {
        dateStr = eventStart.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'America/New_York'
        });
      }
      
      const timeStr = eventStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
      });
      
      const clarificationMessage = `I understand you want to reschedule "${eventToUpdate.summary || eventToUpdate.title}" (currently scheduled for ${dateStr} at ${timeStr}). When would you like to reschedule it to?`;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: clarificationMessage
      }]);
      
      if (userSettings.tts.enabled) {
        playTextToSpeech(clarificationMessage, setIsSpeaking, userSettings);
      }
      
      setPendingReschedule(eventToUpdate);
      
      return;
    }
  
    try {      
      let newStart = eventToUpdate.start;
      let newEnd = eventToUpdate.end;
  
      // Update time/date if provided
      if (updateAnalysis.newTime || updateAnalysis.newDate) {
        const oldStart = new Date(eventToUpdate.start);
        const oldEnd = new Date(eventToUpdate.end);
        const duration = oldEnd - oldStart;
        
        let newStartDate;
        
        if (updateAnalysis.newTime) {
          // Specific time provided
          newStartDate = new Date(updateAnalysis.newTime);
        } else if (updateAnalysis.newDate) {
          // Only date provided, keep the same time
          const newDate = new Date(updateAnalysis.newDate);
          newStartDate = new Date(
            newDate.getFullYear(),
            newDate.getMonth(),
            newDate.getDate(),
            oldStart.getHours(),
            oldStart.getMinutes(),
            oldStart.getSeconds()
          );
        }
        
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        newStart = newStartDate.toISOString();
        newEnd = newEndDate.toISOString();
        
        console.log('Updating event time:');
        console.log('  Old start:', oldStart);
        console.log('  New start:', newStartDate);
        console.log('  Duration:', duration, 'ms');
      }
  
      const updatedData = {
        summary: updateAnalysis.newTitle || eventToUpdate.summary || eventToUpdate.title,
        description: eventToUpdate.description || '',
        start: newStart,
        end: newEnd,
      };
      
      console.log('Sending update to Google Calendar:', updatedData);
      
      const updatedEvent = await updateCalendarEvent(googleAccessToken, eventToUpdate.id, updatedData);
      
      setCalendarEvents(prev => prev.map(e => 
        e.id === eventToUpdate.id 
          ? {
              ...e,
              title: updatedEvent.summary,
              summary: updatedEvent.summary,
              start: updatedEvent.start.dateTime || updatedEvent.start.date,
              end: updatedEvent.end.dateTime || updatedEvent.end.date
            }
          : e
      ));
  
      setRecentlyCreatedEvents(prev => prev.map(e =>
        e.id === eventToUpdate.id
          ? {
              ...e,
              summary: updatedEvent.summary,
              start: updatedEvent.start.dateTime || updatedEvent.start.date,
              end: updatedEvent.end.dateTime || updatedEvent.end.date
            }
          : e
      ));
  
      // Format the success message
      let timeStr = '';
      if (updateAnalysis.newTime || updateAnalysis.newDate) {
      // Determine what the new start time actually is
      let displayStartDate;
      
      if (updateAnalysis.newTime) {
          // Specific time was provided
          displayStartDate = new Date(updateAnalysis.newTime);
      } else if (updateAnalysis.newDate) {
          // Only date was provided, so we kept the original time
          const oldStart = new Date(eventToUpdate.start);
          const newDate = new Date(updateAnalysis.newDate);
          displayStartDate = new Date(
          newDate.getFullYear(),
          newDate.getMonth(),
          newDate.getDate(),
          oldStart.getHours(),
          oldStart.getMinutes(),
          oldStart.getSeconds()
          );
      }
          
      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      
      const newDateStart = new Date(displayStartDate.getFullYear(), displayStartDate.getMonth(), displayStartDate.getDate());
      
      let datePrefix = '';
      if (newDateStart.getTime() === todayStart.getTime()) {
          datePrefix = 'today at ';
      } else if (newDateStart.getTime() === tomorrowStart.getTime()) {
          datePrefix = 'tomorrow at ';
      } else {
          datePrefix = displayStartDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'America/New_York'
          }) + ' at ';
      }
      
      const time = displayStartDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          timeZone: 'America/New_York' 
      });
      
      timeStr = ` to ${datePrefix}${time}`;
      }
      
      const successMessage = `✓ I've updated "${eventToUpdate.summary || eventToUpdate.title}"${timeStr}.`;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: successMessage
      }]);
      
      if (userSettings.tts.enabled) {
        playTextToSpeech(successMessage, setIsSpeaking, userSettings);
      }
      
      setPendingReschedule(null);
      
    } catch (error) {
      console.error('Error updating event:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I had trouble updating that event: ${error.message}`
      }]);
    }
  }