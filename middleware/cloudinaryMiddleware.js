// cloudinaryMiddleware.js
const cloudinary = require("../services/cloudinaryConfig")

const uploadToCloudinary = async (req, res, next) => {
    try {
      const result = await cloudinary.uploader.upload(req.file.path);
      req.cloudinaryUrl = result.secure_url;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error uploading to Cloudinary' });
    }
};

module.exports = uploadToCloudinary;
