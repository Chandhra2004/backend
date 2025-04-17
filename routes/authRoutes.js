const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require("jsonwebtoken");
const router = express.Router();



// Register User
router.post("/register", async (req, res) => {
    try {
      const { name, email, password, mobile, title,address } = req.body;
  
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
  
      
      const hashedPassword = await bcrypt.hash(password, 10);
  
      
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        mobile,
        title,
        address,
        credits:10,
      });
  
      await newUser.save();
      res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
  });





// Login User
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        
        const token = jwt.sign(
            { userId: user._id },
             process.env.JWT_SECRET,
            { expiresIn: "7d" } 
        );

        
        res.status(200).json({
            success: true,
            token, 
            user: {
                userId: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                title: user.title,
                address: user.address,
                credits: user.credits,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
  

module.exports = router;
