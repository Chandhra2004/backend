const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  questions: [
    {
      question: { type: String, required: true },
      options: [{ type: String, required: true }],
      correct_answer: { type: String, required: true },
    },
  ],
});

const Application = mongoose.model("Application", applicationSchema);

module.exports = Application;
