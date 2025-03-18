const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
// const authMiddleware = require(authMiddleware);

// Create or Update User
router.post('/update-skills', async (req, res) => {
    const { userId, skills, interests } = req.body;

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { skills, interests },
            { new: true }
        );

        if (!user) return res.status(404).json({ error: "User not found" });

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 // Make sure this path is correct

// Update user credits
router.put("/update-credits/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { credits } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update credits
    user.credits = credits;
    await user.save();

    res.json({ success: true, credits: user.credits });
  } catch (error) {
    console.error("Error updating credits:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;



// Get Relevant Users by Skill
router.post('/find-users', async (req, res) => {
    const { skillsRequired } = req.body;

    try {
        const users = await User.find({ skills: { $in: skillsRequired } });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user); // Send user data to frontend
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user).select("-password"); // Exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
