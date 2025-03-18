const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true },  // Added mobile number
  title: { type: String, required: true },   // Added title/address
  address: { type: String, required: true },  // Added address field
  credits: { type: Number, default: 10 }, 
  skills: { type: [String], default: [] },
});

module.exports = mongoose.model("User", UserSchema);
