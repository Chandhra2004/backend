const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");
const router = express.Router();
const mongoose = require('mongoose');

// Get past conversations
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId is a valid ObjectId first
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userObjectId }, { receiver: userObjectId }],
        },
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", userObjectId] },
              then: "$receiver",
              else: "$sender",
            },
          },
          lastMessage: { $last: "$message" },
          lastTimestamp: { $last: "$timestamp" },
          messageCount: { $sum: 1 }
        },
      },
      { $sort: { lastTimestamp: -1 } }, // Sort by most recent
    ]);

    const conversationDetails = await Promise.all(
      conversations.map(async (conv) => {
        try {
          const user = await User.findById(conv._id);
          if (!user) {
            return {
              _id: conv._id,
              name: "Unknown User",
              lastMessage: conv.lastMessage || "Image",
              timestamp: conv.lastTimestamp,
              messageCount: conv.messageCount
            };
          }
          return {
            _id: user._id,
            name: user.name,
            lastMessage: conv.lastMessage || "Image",
            timestamp: conv.lastTimestamp,
            messageCount: conv.messageCount
          };
        } catch (err) {
          console.error(`Error fetching user ${conv._id}:`, err);
          return {
            _id: conv._id,
            name: "Unknown User",
            lastMessage: conv.lastMessage || "Image",
            timestamp: conv.lastTimestamp,
            messageCount: conv.messageCount
          };
        }
      })
    );

    res.json(conversationDetails);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Error fetching conversations", error: error.message });
  }
});

// Get messages between two users
router.get("/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    
    // Validate both IDs
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    }).sort({ timestamp: 1 }); // Sort by timestamp ascending
    
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages", error: error.message });
  }
});

// Save message (for Socket.io integration)
router.post("/", async (req, res) => {
  try {
    const { sender, receiver, message, type = "text" } = req.body;
    
    // Validate required fields
    if (!sender || !receiver || (!message && type === "text")) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(sender) || !mongoose.Types.ObjectId.isValid(receiver)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const newMessage = new Message({
      sender,
      receiver,
      message,
      type,
      timestamp: new Date()
    });
    
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ message: "Error saving message", error: error.message });
  }
});

module.exports = router;