const mongoose = require("mongoose");

const SkillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    unique: true
  },
  skills: {
    type: [String], 
    default: []
  },
  detectedAt: {
    type: Date,
    default: Date.now 
  }
});

module.exports = mongoose.model("Skill", SkillSchema);
