
const jwt = require("jsonwebtoken")


const asyncHandler = require("express-async-handler")
const User = require("../models/PatientSchema")



exports.protect = asyncHandler(async (req, res, next) => {
    // 1) Check if token exist, if exist get
    let token
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1]
    }
    if (!token) {
        return  res.status(401).json({ message: "You are not logged in! Please log in to get access." })
    }

    // 2) Verify token (no change happens, expired token)
    const decoded = jwt.verify(token, process.env.privateKey)
    console.log(decoded);
    // 3) Check if user exists
    const currentUser = await User.findById(decoded._id)
    if (!currentUser) {
        return  res.status(401).json({ message: "The user belonging to this token does no longer exist." })
    }

    // 4) Check if user change his password after token created

    req.user = currentUser
    next()
})

