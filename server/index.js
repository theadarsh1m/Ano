const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for dev
    methods: ['GET', 'POST']
  }
});

// State management
const rooms = new Map(); // roomId -> Set of user objects { socketId, userId, nickname }
const userToRoom = new Map(); // socketId -> roomId

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join Room
  socket.on('join_room', ({ roomId, userId, nickname }) => {
    socket.join(roomId);
    userToRoom.set(socket.id, roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const user = { socketId: socket.id, userId, nickname };
    rooms.get(roomId).add(user);

    // Send the current list of online users to the room
    const usersInRoom = Array.from(rooms.get(roomId));
    io.to(roomId).emit('room_users', usersInRoom);

    // Broadcast join message (system message)
    const joinMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId: 'system',
      senderName: 'System',
      content: `${nickname} joined the room.`,
      timestamp: Date.now(),
      type: 'system'
    };
    
    // Broadcast to everyone in room including sender (so they know they joined successfully)
    io.to(roomId).emit('receive_message', joinMessage);
    
    console.log(`${nickname} (${socket.id}) joined room ${roomId}`);
  });

  // Send Message
  socket.on('send_message', (message) => {
    // message = { id, roomId, senderId, senderName, content, timestamp }
    io.to(message.roomId).emit('receive_message', message);
  });

  // Typing Indicators
  socket.on('typing_start', ({ roomId, nickname }) => {
    socket.to(roomId).emit('user_typing', { nickname, isTyping: true });
  });

  socket.on('typing_stop', ({ roomId, nickname }) => {
    socket.to(roomId).emit('user_typing', { nickname, isTyping: false });
  });

  // Leave Room / Disconnect Handling
  const handleLeave = () => {
    const roomId = userToRoom.get(socket.id);
    if (roomId && rooms.has(roomId)) {
      const roomUsers = rooms.get(roomId);
      let userNickname = 'Unknown';
      let userId = null;

      // Find the user object to get the nickname
      for (const user of roomUsers) {
        if (user.socketId === socket.id) {
          userNickname = user.nickname;
          userId = user.userId;
          roomUsers.delete(user);
          break;
        }
      }

      // If room is empty, we could delete it, but let's keep it simple
      if (roomUsers.size === 0) {
        rooms.delete(roomId);
      } else {
        // Send updated users list
        io.to(roomId).emit('room_users', Array.from(roomUsers));
      }

      userToRoom.delete(socket.id);
      socket.leave(roomId);

      // Broadcast leave message
      const leaveMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        roomId,
        senderId: 'system',
        senderName: 'System',
        content: `${userNickname} left the room.`,
        timestamp: Date.now(),
        type: 'system'
      };
      
      io.to(roomId).emit('receive_message', leaveMessage);
      console.log(`${userNickname} left room ${roomId}`);
    }
  };

  socket.on('leave_room', handleLeave);
  socket.on('disconnect', handleLeave);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO Server is running on port ${PORT}`);
});
