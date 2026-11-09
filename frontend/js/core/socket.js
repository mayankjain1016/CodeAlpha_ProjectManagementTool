/**
 * TaskFlow Socket.IO Client Manager
 * Handles real-time connection, room joins, live updates, and quiet status.
 */

import { getToken, getUser } from './auth.js';
import { showToast } from './toast.js';

let socket = null;
let currentJoinedProject = null;
const eventListeners = new Map();
const notifListeners = new Set();

export function initClientSocket() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return null;

  // If already connected, return existing socket
  if (socket && socket.connected) return socket;

  // Check if io global is available (from /socket.io/socket.io.js)
  if (typeof window.io !== 'function') {
    // Dynamically load the local /socket.io/socket.io.js script if not present
    if (!document.getElementById('socket-io-script')) {
      const script = document.createElement('script');
      script.id = 'socket-io-script';
      script.src = '/socket.io/socket.io.js';
      script.onload = () => {
        setupSocketConnection(token);
      };
      script.onerror = () => {
        console.info('[realtime] Socket.IO server script not available, falling back to background polling');
      };
      document.head.appendChild(script);
    }
    return null;
  }

  return setupSocketConnection(token);
}

function setupSocketConnection(token) {
  if (typeof window.io !== 'function') return null;

  try {
    socket = window.io({
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[realtime] Connected to real-time server (id: ' + socket.id + ')');
      updateRealtimeStatusIndicator('connected');

      // Re-join current project if was joined
      if (currentJoinedProject) {
        socket.emit('project:join', currentJoinedProject);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[realtime] Disconnected:', reason);
      updateRealtimeStatusIndicator('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.warn('[realtime] Connection error:', err.message);
      updateRealtimeStatusIndicator('reconnecting');
    });

    // Handle personal direct notification
    socket.on('notification:new', (notification) => {
      // Bump unread badge
      const badge = document.getElementById('notification-badge');
      if (badge) badge.classList.add('active');

      // Show toast alert
      let message = 'You have a new notification';
      if (notification.type === 'assigned') {
        message = `${notification.actor?.name || 'Someone'} assigned you to "${notification.task?.title || 'a task'}"`;
      } else if (notification.type === 'commented') {
        message = `${notification.actor?.name || 'Someone'} commented on "${notification.task?.title || 'a task'}"`;
      } else if (notification.type === 'added_to_project') {
        message = `${notification.actor?.name || 'Someone'} added you to project "${notification.project?.name || ''}"`;
      }
      showToast(message, 'info', 4000);

      // Invoke listeners
      notifListeners.forEach((cb) => cb(notification));
    });

    // Forward project events to registered listeners
    const PROJECT_EVENTS = [
      'task:created',
      'task:updated',
      'task:moved',
      'task:deleted',
      'comment:created',
      'comment:deleted',
      'member:added',
      'member:removed',
      'project:updated',
    ];

    PROJECT_EVENTS.forEach((evtName) => {
      socket.on(evtName, (data) => {
        const callbacks = eventListeners.get(evtName);
        if (callbacks) {
          callbacks.forEach((cb) => cb(data));
        }
      });
    });

    return socket;
  } catch (err) {
    console.error('[realtime] Failed to initialize socket:', err);
    return null;
  }
}

export function joinProjectRoom(projectId) {
  currentJoinedProject = projectId;
  if (socket && socket.connected) {
    socket.emit('project:join', projectId);
  }
}

export function leaveProjectRoom(projectId) {
  if (currentJoinedProject === projectId) {
    currentJoinedProject = null;
  }
  if (socket && socket.connected) {
    socket.emit('project:leave', projectId);
  }
}

export function onProjectEvent(event, callback) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event).add(callback);

  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

export function onNotification(callback) {
  notifListeners.add(callback);
  return () => notifListeners.delete(callback);
}

function updateRealtimeStatusIndicator(status) {
  const dot = document.getElementById('realtime-status-dot');
  if (!dot) return;

  if (status === 'connected') {
    dot.className = 'realtime-status-dot connected';
    dot.title = 'Real-time sync active';
  } else if (status === 'reconnecting') {
    dot.className = 'realtime-status-dot reconnecting';
    dot.title = 'Reconnecting real-time sync...';
  } else {
    dot.className = 'realtime-status-dot disconnected';
    dot.title = 'Offline sync mode (polling active)';
  }
}

