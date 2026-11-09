/**
 * Socket.IO Real-Time Engine for TaskFlow
 * Authenticates connections with JWT, manages project rooms and user rooms,
 * and broadcasts real-time events.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // JWT Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id name email avatarHue');
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    // Join personal user room for direct notifications
    socket.join(`user:${userId}`);

    // Join / leave project rooms
    socket.on('project:join', (projectId) => {
      if (projectId) {
        socket.join(`project:${projectId}`);
      }
    });

    socket.on('project:leave', (projectId) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      // Disconnect handled cleanly
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToProject(projectId, event, data) {
  if (io && projectId) {
    io.to(`project:${projectId}`).emit(event, data);
  }
}

function emitToUser(userId, event, data) {
  if (io && userId) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToProject,
  emitToUser,
};

