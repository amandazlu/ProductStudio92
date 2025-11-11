import { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ReactDOM from 'react-dom';
import {
  fetchCalendarEvents,
  createCalendarEvent
} from '../services/googleCalendar';

const localizer = momentLocalizer(moment);

export default function CalendarView({ googleAccessToken, onAddEvent, onUpdateEvent, onDeleteEvent, events: eventsProp }) {
    const [events, setEvents] = useState([]);
    const [modalData, setModalData] = useState(null); // event being created or edited
    const [currentView, setCurrentView] = useState('week');

    useEffect(() => {
      setEvents(eventsProp || []);
    }, [eventsProp]);

  // Fetch events from backend
    const loadEvents = async () => {
        if (!googleAccessToken) return;
        try {
        const data = await fetchCalendarEvents(googleAccessToken);
        console.log("Fetched events from backend:", data);

        const formatted = data.map((e) => ({
            id: e.id,
            title: e.summary || '(No Title)',
            start: new Date(e.start.dateTime || e.start.date),
            end: new Date(e.end.dateTime || e.end.date),
        }));
        console.log("Formatted events:", formatted);
        const safeEvents = formatted.filter(e => e.start && e.end);
        setEvents(safeEvents);
        } catch (error) {
        console.error('Failed to fetch calendar events:', error);
        }
    };

  useEffect(() => { loadEvents(); }, [googleAccessToken]);

   // Click empty slot to create a new event
  const handleSelectSlot = ({ start, end }) => {
    setModalData({ id: null, start, end, title: '', description: '' });
  };

  // Click an existing event to edit/view
  const handleSelectEvent = (event) => {
    setModalData({ ...event });
  };

  const handleModalSubmit = async () => {
    if (!modalData.title) return alert('Title is required');
  
    if (modalData.id) {
      // Updating existing event
      const updatedEvent = await onUpdateEvent(modalData.id, {
        summary: modalData.title,
        description: modalData.description,
        start: modalData.start,
        end: modalData.end,
      });
      setEvents(prev => prev.map(e => e.id === modalData.id ? updatedEvent : e));
    } else {
      // Creating new event
      const newEvent = await onAddEvent({
        summary: modalData.title,
        description: modalData.description,
        start: modalData.start,
        end: modalData.end,
      });
      // Update local state with returned event from backend
      setEvents(prev => [...prev, {
        id: newEvent.id,
        title: newEvent.summary,
        description: newEvent.description,
        start: new Date(newEvent.start.dateTime || newEvent.start.date),
        end: new Date(newEvent.end.dateTime || newEvent.end.date),
      }]);
    }
  
    setModalData(null);
  };
  

  const handleDelete = async () => {
    if (modalData.id && window.confirm('Delete this event?')) {
      await onDeleteEvent(modalData.id);
      setEvents(prev => prev.filter(e => e.id !== modalData.id));
      setModalData(null);
      loadEvents();
    }
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };


  return (
    <div style={{ height: 600, background: 'white', padding: '1rem' }}>
      {/* Refresh Button */}
      <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
        <button 
          onClick={loadEvents} 
          style={{ padding: '0.5rem 1rem', background: 'blue', color: 'white', borderRadius: '4px' }}
        >
          Refresh Calendar
        </button>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        views={['month', 'week', 'day', 'agenda']} // enable week view
        defaultView='week' // default to week view
        onView={handleViewChange}
        style={{
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      />
      
        {modalData && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', minWidth: '300px' }}>
            <h3>{modalData.id ? 'Edit Event' : 'Create Event'}</h3>
            <input
              placeholder="Title"
              value={modalData.title}
              onChange={e => setModalData({ ...modalData, title: e.target.value })}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <textarea
              placeholder="Description"
              value={modalData.description}
              onChange={e => setModalData({ ...modalData, description: e.target.value })}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {modalData.id && <button onClick={handleDelete} style={{ color: 'red' }}>Delete</button>}
              <button onClick={() => setModalData(null)}>Cancel</button>
              <button onClick={handleModalSubmit}>{modalData.id ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}