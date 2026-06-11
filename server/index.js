const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const roomService = require('./services/roomService');
const messageService = require('./services/messageService');
const userService = require('./services/userService');
const uploadService = require('./services/uploadService');

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

    // Return enriched response with publicId and secureUrl
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
    const resourceType = req.query.type || 'image'; // 'image' or 'raw'

    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required' });
    }

    // Enforce: only allow deleting assets under the Ano/ folder
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

// In-memory state for online tracking (not persisted)
const rooms = new Map(); // roomId -> Set of user objects { socketId, userId, nickname }
const userToRoom = new Map(); // socketId -> roomId

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join Room
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

    // Persist system message
    try {
      await messageService.saveMessage(joinMessage);
    } catch (err) {
      console.error('Failed to save join message:', err.message);
    }

    console.log(`${nickname} (${socket.id}) joined room ${roomId}`);
  });

  // Send Message
  socket.on('send_message', async (message) => {
    // Broadcast to room
    io.to(message.roomId).emit('receive_message', message);

    // Persist message to database
    try {
      await messageService.saveMessage(message);
    } catch (err) {
      console.error('Failed to save message:', err.message);
    }
  });

  // Typing Indicators
  socket.on('typing_start', ({ roomId, nickname }) => {
    socket.to(roomId).emit('user_typing', { nickname, isTyping: true });
  });

  socket.on('typing_stop', ({ roomId, nickname }) => {
    socket.to(roomId).emit('user_typing', { nickname, isTyping: false });
  });

  // Leave Room / Disconnect Handling
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

      // Update lastSeen in database
      if (userId) {
        try {
          await userService.updateLastSeen(userId);
        } catch (err) {
          console.error('Failed to update lastSeen:', err.message);
        }
      }

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

      // Persist leave message
      try {
        await messageService.saveMessage(leaveMessage);
      } catch (err) {
        console.error('Failed to save leave message:', err.message);
      }

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
