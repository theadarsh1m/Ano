const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const roomService = require('./services/roomService');
const messageService = require('./services/messageService');
const userService = require('./services/userService');
const uploadService = require('./services/uploadService');
const conversationService = require('./services/conversationService');
const dmService = require('./services/dmService');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ========================
// REST API ENDPOINTS
// ========================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all public rooms
app.get('/api/rooms/public', async (req, res) => {
  try {
    const rooms = await roomService.getAllPublicRooms();
    res.json(rooms);
  } catch (err) {
    console.error('Error fetching public rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get a single room by ID or invite code
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const room = await roomService.getRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    console.error('Error fetching room:', err);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const { name, type, createdBy, description } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    const room = await roomService.createRoom(name, type, createdBy, description);
    res.status(201).json(room);
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get chat history for a room
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = await messageService.getMessages(req.params.roomId, limit);
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ========================
// USER ENDPOINTS
// ========================

// Upsert an anonymous user
app.post('/api/users', async (req, res) => {
  try {
    const { id, nickname } = req.body;
    if (!id || !nickname) {
      return res.status(400).json({ error: 'id and nickname are required' });
    }
    const user = await userService.upsertUser(id, nickname);
    res.json(user);
  } catch (err) {
    console.error('Error upserting user:', err);
    res.status(500).json({ error: 'Failed to upsert user' });
  }
});

// Search users by nickname
app.get('/api/users/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const users = await userService.searchUsers(query);
    res.json(users);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user profile
app.get('/api/users/:userId', async (req, res) => {
  try {
    const profile = await userService.getUserProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { nickname, bio, avatar } = req.body;
    const profile = await userService.updateProfile(req.params.userId, { nickname, bio, avatar });
    res.json(profile);
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ========================
// CONVERSATION ENDPOINTS
// ========================

// Create or get a conversation between two users
app.post('/api/conversations', async (req, res) => {
  try {
    const { userAId, userBId } = req.body;
    if (!userAId || !userBId) {
      return res.status(400).json({ error: 'userAId and userBId are required' });
    }
    if (userAId === userBId) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }
    const conversation = await conversationService.getOrCreateConversation(userAId, userBId);
    res.json(conversation);
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get all conversations for a user
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const conversations = await conversationService.getConversationsForUser(req.params.userId);
    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get DM history for a conversation
app.get('/api/dm/:conversationId/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = await dmService.getDirectMessages(req.params.conversationId, limit);
    res.json(messages);
  } catch (err) {
    console.error('Error fetching DM messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get a single conversation by ID
app.get('/api/dm/:conversationId', async (req, res) => {
  try {
    const conversation = await conversationService.getConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// ========================
// FILE UPLOAD ENDPOINTS
// ========================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB hard limit
});

// Safe Cloudinary config (no secrets)
app.get('/api/cloudinary/config', (req, res) => {
  const { safeConfig } = require('./config/cloudinary');
  res.json(safeConfig);
});

// General upload — auto-routes images to Ano/chat-images, files to Ano/attachments
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const validation = uploadService.validate(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await uploadService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    res.json({
      publicId: result.publicId,
      secureUrl: result.secureUrl,
      url: result.secureUrl, // backward compat
      width: result.width || null,
      height: result.height || null,
      format: result.format || null,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
    });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Profile picture upload — stores in Ano/profile-pictures
app.post('/api/upload/profile-picture', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const userId = req.body.userId;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const validation = uploadService.validateImage(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await uploadService.uploadProfilePicture(file.buffer, userId);

    res.json({
      publicId: result.publicId,
      secureUrl: result.secureUrl,
    });
  } catch (err) {
    console.error('Profile picture upload error:', err.message);
    res.status(500).json({ error: 'Profile picture upload failed' });
  }
});

// Attachment upload — stores in Ano/attachments
app.post('/api/upload/attachment', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const validation = uploadService.validate(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await uploadService.uploadAttachment(file.buffer, file.originalname);

    res.json({
      publicId: result.publicId,
      secureUrl: result.secureUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
    });
  } catch (err) {
    console.error('Attachment upload error:', err.message);
    res.status(500).json({ error: 'Attachment upload failed' });
  }
});

// Delete an uploaded asset (image or raw file)
// Usage: DELETE /api/upload?publicId=Ano/chat-images/123&type=image
app.delete('/api/upload', async (req, res) => {
  try {
    const publicId = req.query.publicId;
    const resourceType = req.query.type || 'image';

    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required' });
    }

    if (!publicId.startsWith('Ano/')) {
      return res.status(403).json({ error: 'Can only delete assets under the Ano/ folder' });
    }

    let result;
    if (resourceType === 'raw') {
      result = await uploadService.deleteAttachment(publicId);
    } else {
      result = await uploadService.deleteImage(publicId);
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ========================
// SOCKET.IO HANDLERS
// ========================

// In-memory state
const rooms = new Map();        // roomId -> Set of { socketId, userId, nickname }
const userToRoom = new Map();   // socketId -> roomId
const onlineUsers = new Map();  // userId -> Set<socketId> (global presence)
const socketToUser = new Map(); // socketId -> { userId, nickname }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ========================
  // GLOBAL PRESENCE
  // ========================

  socket.on('register_user', ({ userId, nickname }) => {
    if (!userId) return;

    socketToUser.set(socket.id, { userId, nickname });

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast that this user is online
    socket.broadcast.emit('user_online', { userId });

    // Send current online user list to the connecting user
    const onlineIds = Array.from(onlineUsers.keys());
    socket.emit('online_users', onlineIds);
  });

  // ========================
  // ROOM CHAT
  // ========================

  socket.on('join_room', async ({ roomId, userId, nickname }) => {
    socket.join(roomId);
    userToRoom.set(socket.id, roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const user = { socketId: socket.id, userId, nickname };
    rooms.get(roomId).add(user);

    // Persist user to database
    try {
      await userService.upsertUser(userId, nickname);
    } catch (err) {
      console.error('Failed to upsert user on join:', err.message);
    }

    // Send the current list of online users to the room
    const usersInRoom = Array.from(rooms.get(roomId));
    io.to(roomId).emit('room_users', usersInRoom);

    // Send chat history to the joining user
    try {
      const history = await messageService.getMessages(roomId, 50);
      socket.emit('chat_history', history);
    } catch (err) {
      console.error('Failed to load chat history:', err.message);
    }

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

    io.to(roomId).emit('receive_message', joinMessage);

    try {
      await messageService.saveMessage(joinMessage);
    } catch (err) {
      console.error('Failed to save join message:', err.message);
    }

    console.log(`${nickname} (${socket.id}) joined room ${roomId}`);
  });

  socket.on('send_message', async (message) => {
    io.to(message.roomId).emit('receive_message', message);

    try {
      await messageService.saveMessage(message);
    } catch (err) {
      console.error('Failed to save message:', err.message);
    }
  });

  socket.on('typing_start', ({ roomId, nickname }) => {
    socket.to(roomId).emit('user_typing', { nickname, isTyping: true });
  });

  socket.on('typing_stop', ({ roomId, nickname }) => {
    socket.to(roomId).emit('user_typing', { nickname, isTyping: false });
  });

  // ========================
  // DIRECT MESSAGES
  // ========================

  socket.on('join_dm', ({ conversationId }) => {
    socket.join(`dm_${conversationId}`);
  });

  socket.on('leave_dm', ({ conversationId }) => {
    socket.leave(`dm_${conversationId}`);
  });

  socket.on('dm_send', async (message) => {
    // Broadcast to the DM room
    io.to(`dm_${message.conversationId}`).emit('dm_receive', message);

    // Also send to the other participant's sockets if they're not in the DM room
    // (so they can update unread counts)
    if (message.recipientId) {
      const recipientSockets = onlineUsers.get(message.recipientId);
      if (recipientSockets) {
        for (const socketId of recipientSockets) {
          const recipientSocket = io.sockets.sockets.get(socketId);
          if (recipientSocket && !recipientSocket.rooms.has(`dm_${message.conversationId}`)) {
            recipientSocket.emit('dm_notification', {
              conversationId: message.conversationId,
              message,
            });
          }
        }
      }
    }

    // Persist to database
    try {
      await dmService.saveDirectMessage(message);
    } catch (err) {
      console.error('Failed to save DM:', err.message);
    }
  });

  socket.on('dm_typing_start', ({ conversationId, nickname }) => {
    socket.to(`dm_${conversationId}`).emit('dm_user_typing', {
      conversationId,
      nickname,
      isTyping: true,
    });
  });

  socket.on('dm_typing_stop', ({ conversationId, nickname }) => {
    socket.to(`dm_${conversationId}`).emit('dm_user_typing', {
      conversationId,
      nickname,
      isTyping: false,
    });
  });

  // ========================
  // LEAVE / DISCONNECT
  // ========================

  const handleLeave = async () => {
    const roomId = userToRoom.get(socket.id);
    if (roomId && rooms.has(roomId)) {
      const roomUsers = rooms.get(roomId);
      let userNickname = 'Unknown';
      let userId = null;

      for (const user of roomUsers) {
        if (user.socketId === socket.id) {
          userNickname = user.nickname;
          userId = user.userId;
          roomUsers.delete(user);
          break;
        }
      }

      if (roomUsers.size === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room_users', Array.from(roomUsers));
      }

      userToRoom.delete(socket.id);
      socket.leave(roomId);

      if (userId) {
        try {
          await userService.updateLastSeen(userId);
        } catch (err) {
          console.error('Failed to update lastSeen:', err.message);
        }
      }

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

      try {
        await messageService.saveMessage(leaveMessage);
      } catch (err) {
        console.error('Failed to save leave message:', err.message);
      }

      console.log(`${userNickname} left room ${roomId}`);
    }
  };

  const handleDisconnect = async () => {
    // Handle room leave
    await handleLeave();

    // Handle global presence
    const userData = socketToUser.get(socket.id);
    if (userData) {
      const { userId } = userData;
      const userSockets = onlineUsers.get(userId);

      if (userSockets) {
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline only when ALL tabs are closed
          socket.broadcast.emit('user_offline', { userId });

          // Update lastSeen
          try {
            await userService.updateLastSeen(userId);
          } catch (err) {
            console.error('Failed to update lastSeen on disconnect:', err.message);
          }
        }
      }

      socketToUser.delete(socket.id);
    }
  };

  socket.on('leave_room', handleLeave);
  socket.on('disconnect', handleDisconnect);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO Server is running on port ${PORT}`);
});
