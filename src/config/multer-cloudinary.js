const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('./cloudinary');
const path = require('path');

const getResourceType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (imageExts.includes(ext)) return 'image';
  return 'raw';
};

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const resourceType = getResourceType(file.originalname);
    const subjectId = req.body.subjectId || 'general';
    const folder = `etab_materials/${subjectId}/${resourceType}s`;
    
    return {
      folder: folder,
      resource_type: resourceType,
      allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'mp4', 'webm', 'mov', 'avi', 'zip', 'jpg', 'png']
    };
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

const handleUpload = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  };
};

const deleteFromCloudinary = async (publicId, resourceType = 'raw') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return false;
  }
};

module.exports = {
  upload,
  handleUpload,
  deleteFromCloudinary,
  cloudinary
};