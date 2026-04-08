const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// Initialize Socket.IO server
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        // Allow all origins in development
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.userId = decoded.userId;
      socket.schoolId = decoded.schoolId;
      socket.userRole = decoded.role;
      
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`🔌 [SOCKET] User connected: ${socket.userId} (${socket.userRole})`);
    
    // Join user-specific room for direct messages
    socket.join(`user:${socket.userId}`);
    
    // Join school-specific room for school-wide updates
    if (socket.schoolId) {
      socket.join(`school:${socket.schoolId}`);
      console.log(`🔌 [SOCKET] Joined school room: ${socket.schoolId}`);
    }
    
    // Join role-specific rooms
    socket.join(`role:${socket.userRole}`);
    
    // Super admins join the super-admin room
    if (socket.userRole === 'admin' || socket.user?.isSuperAdmin) {
      socket.join('super-admins');
      console.log(`🔌 [SOCKET] Joined super-admins room`);
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 [SOCKET] User disconnected: ${socket.userId} (${reason})`);
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error(`🔌 [SOCKET] Error for ${socket.userId}:`, err.message);
    });
  });

  return io;
}

// Get io instance
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

// Emit to specific user
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

// Emit to school
function emitToSchool(schoolId, event, data) {
  if (!io) return;
  io.to(`school:${schoolId}`).emit(event, data);
}

// Emit to all admins in a school
function emitToSchoolAdmins(schoolId, event, data) {
  if (!io) return;
  io.to(`school:${schoolId}`).to('role:school_admin').emit(event, data);
}

// Emit to super admins
function emitToSuperAdmins(event, data) {
  if (!io) return;
  io.to('super-admins').emit(event, data);
}

// Emit to all connected clients
function emitToAll(event, data) {
  if (!io) return;
  io.emit(event, data);
}

// Broadcast to everyone except sender
function broadcastToOthers(socket, event, data) {
  socket.broadcast.emit(event, data);
}

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToSchool,
  emitToSchoolAdmins,
  emitToSuperAdmins,
  emitToAll,
  broadcastToOthers
};
