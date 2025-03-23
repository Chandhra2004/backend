require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require("http");
const { Server } = require("socket.io");
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const skillRoutes = require('./routes/skillRoutes');
const messageRoutes = require("./routes/messageRoutes");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration
const corsOptions = {
  origin: "https://aiskillconnect.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware with options
app.use(cors(corsOptions));

// Socket.IO with proper CORS configuration
const io = new Server(server, {
  path: "/chat",
  cors: {
    origin: "https://aiskillconnect.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true
  },
});

// Middleware
app.use(express.json());

// Preflight CORS handler for all routes
// app.options('*', cors(corsOptions));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/skills', skillRoutes);
app.use("/api/messages", messageRoutes);

// Validate environment variables
if (!process.env.MONGO_URI || !process.env.PORT) {
  console.error("Missing environment variables: MONGO_URI or PORT");
  process.exit(1);
}

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Map to track online users
let onlineUsers = new Map();
// Track active socket-room relationships to prevent duplicate joins
const socketRooms = new Map();
// Track recently processed messages to prevent duplicates
const recentMessages = new Map();

// Socket.IO events
io.on("connection", (socket) => {
  console.log("✅ New user connected:", socket.id);

  // Handle user joining
  socket.on("join", (userId) => {
    // Check if user already has a socket connection
    const existingSocketId = onlineUsers.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
      // Inform the old socket it's being replaced
      io.to(existingSocketId).emit("session_expired", {
        message: "Your session was connected from another device or tab"
      });
      
      // Get the socket instance if it still exists
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        console.log(`Disconnecting previous socket for user ${userId}: ${existingSocketId}`);
        existingSocket.disconnect(true);
      }
    }
    
    // Update the user's socket in our map
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} joined with socket ID: ${socket.id}`);
  });

  // Handle join_room - Clean up previous rooms first
  socket.on("join_room", (room) => {
    // Get current rooms this socket is in
    const currentRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    
    // Leave all previous rooms
    currentRooms.forEach(oldRoom => {
      socket.leave(oldRoom);
      console.log(`Socket ${socket.id} left room: ${oldRoom}`);
    });
    
    // Now join the new room
    socket.join(room);
    socketRooms.set(socket.id, room);
    console.log(`Client joined room: ${room}`);
  });
  
  socket.on("leave_room", (room) => {
    if (room) {
      socket.leave(room);
      console.log(`Client explicitly left room: ${room}`);
    } else {
      // If no specific room provided, leave all rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
          console.log(`Client left room: ${room}`);
        }
      });
    }
    
    // Update our tracking
    socketRooms.delete(socket.id);
  });

  // Handle send_message with MongoDB save and duplicate prevention
  socket.on("send_message", async (msg) => {
    try {
      // Generate a message fingerprint to detect duplicates
      const messageFingerprint = `${msg.sender}-${msg.receiver}-${msg.timestamp}`;
      
      // Check if we've recently processed this exact message
      if (recentMessages.has(messageFingerprint)) {
        console.log(`Prevented duplicate message: ${messageFingerprint}`);
        return;
      }
      
      // Add to recent messages with a 5-second expiration
      recentMessages.set(messageFingerprint, true);
      setTimeout(() => recentMessages.delete(messageFingerprint), 5000);
      
      // Create and save the message
      const message = new Message({
        sender: msg.sender,
        receiver: msg.receiver,
        message: msg.message,
        image: msg.image,
        timestamp: new Date(),
      });
      
      const savedMessage = await message.save();
      
      // Only emit the saved message with its MongoDB _id
      io.to(msg.room).emit("receive_message", savedMessage);
      console.log("Message saved and sent:", savedMessage._id);
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("message_error", { 
        error: "Failed to process message",
        details: error.message
      });
    }
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    let disconnectedUserId = null;
    
    // Find and remove user from online users
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        disconnectedUserId = userId;
        break;
      }
    }
    
    // Clean up socket room tracking
    socketRooms.delete(socket.id);
    
    if (disconnectedUserId) {
      console.log(`User ${disconnectedUserId} disconnected`);
    } else {
      console.log(`Socket ${socket.id} disconnected (no user found)`);
    }
  });
});

// CORS error handling middleware
app.use((err, req, res, next) => {
  if (err.name === 'CORSError') {
    return res.status(403).json({
      message: 'CORS error: Origin not allowed',
      error: err.message
    });
  }
  next(err);
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start the server
server.listen(process.env.PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${process.env.PORT}`);
});

module.exports = app;