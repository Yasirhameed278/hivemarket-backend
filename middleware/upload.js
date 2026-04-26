const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Local storage fallback
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);
  if (extname && mimetype) cb(null, true);
  else cb(new Error('Only image files allowed'));
};

const upload = multer({ storage: localStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Upload to cloudinary or return local URL
const uploadToCloudinary = async (filePath, folder = 'ecommerce') => {
  try {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await cloudinary.uploader.upload(filePath, { folder, resource_type: 'auto' });
      fs.unlinkSync(filePath); // Remove local file
      return result.secure_url;
    }
    return `/uploads/${path.basename(filePath)}`;
  } catch (err) {
    return `/uploads/${path.basename(filePath)}`;
  }
};

module.exports = { upload, uploadToCloudinary, cloudinary };
