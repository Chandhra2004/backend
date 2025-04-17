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


const corsOptions = {
  origin: ["http://localhost:3000", "https://aiskillconnect.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};


app.use(cors(corsOptions));


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


let onlineUsers = new Map();
const socketRooms = new Map();
const recentMessages = new Map();

// Socket.IO events
io.on("connection", (socket) => {
  console.log("✅ New user connected:", socket.id);
  socket.on("join", (userId) => {
    
    const existingSocketId = onlineUsers.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
      io.to(existingSocketId).emit("session_expired", {
        message: "Your session was connected from another device or tab"
      });
      
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        console.log(`Disconnecting previous socket for user ${userId}: ${existingSocketId}`);
        existingSocket.disconnect(true);
      }
    }
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} joined with socket ID: ${socket.id}`);
  });

  socket.on("join_room", (room) => {
    const currentRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    currentRooms.forEach(oldRoom => {
      socket.leave(oldRoom);
      console.log(`Socket ${socket.id} left room: ${oldRoom}`);
    });
    
    socket.join(room);
    socketRooms.set(socket.id, room);
    console.log(`Client joined room: ${room}`);
  });
  
  socket.on("leave_room", (room) => {
    if (room) {
      socket.leave(room);
      console.log(`Client explicitly left room: ${room}`);
    } else {
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
  socket.on("send_message", async (msg) => {
    try {
      const messageFingerprint = `${msg.sender}-${msg.receiver}-${msg.timestamp}`;
      if (recentMessages.has(messageFingerprint)) {
        console.log(`Prevented duplicate message: ${messageFingerprint}`);
        return;
      }
      
      recentMessages.set(messageFingerprint, true);
      setTimeout(() => recentMessages.delete(messageFingerprint), 5000);
      
      const message = new Message({
        sender: msg.sender,
        receiver: msg.receiver,
        message: msg.message,
        image: msg.image,
        timestamp: new Date(),
      });
      
      const savedMessage = await message.save();
      
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
    
    
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        disconnectedUserId = userId;
        break;
      }
    }
    
    
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


server.listen(process.env.PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${process.env.PORT}`);
});

module.exports = app;