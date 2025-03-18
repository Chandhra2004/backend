const jwt = require("jsonwebtoken");

// Same secret key

module.exports = (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        return res.status(401).json({ success: false, message: "Access denied" });
    }

    try {
        const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        req.user = decoded.userId; // Attach user ID to request
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};
