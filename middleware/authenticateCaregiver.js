const jwt = require("jsonwebtoken");
const User = require("../models/caregiverSchema");

const authenticate = async (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.privateKey);
       // console.log(decoded)
        // Check if decoded data contains user ID
        if (!decoded._id) {
            throw new Error("Invalid token: User ID not found");
        }

        // Find user by ID in database
        const user = await User.findById(decoded._id);
        if (!user) {
            throw new Error("Invalid token: User not found");
        }

        // Set user in request object
        req.user = user;
        next();
    } catch (error) {
        console.error("Authentication error:", error.message);
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
};

module.exports = authenticate;
