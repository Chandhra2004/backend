const mongoose = require("mongoose");

const SkillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the user
    required: true,
    unique: true
  },
  skills: {
    type: [String], // Array of detected skills
    default: []
  },
  detectedAt: {
    type: Date,
    default: Date.now // Timestamp for when skills were detected
  }
});

module.exports = mongoose.model("Skill", SkillSchema);
