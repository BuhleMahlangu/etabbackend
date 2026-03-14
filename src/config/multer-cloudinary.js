const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('./cloudinary');
const path = require('path');

const getResourceType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (imageExts.includes(ext)) return 'image';
  return 'raw';
};

const getFileFormat = (filename) => {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  // Map extensions to Cloudinary format names
  const formatMap = {
    'jpg': 'jpg',
    'jpeg': 'jpg',
    'png': 'png',
    'gif': 'gif',
    'webp': 'webp',
    'svg': 'svg',
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'docx',
    'ppt': 'ppt',
    'pptx': 'pptx',
    'xls': 'xls',
    'xlsx': 'xlsx',
    'txt': 'txt',
    'rtf': 'rtf',
    'odt': 'odt',
    'zip': 'zip',
    'rar': 'rar',
    'mp4': 'mp4',
    'webm': 'webm',
    'mov': 'mov',
    'avi': 'avi'
  };
  return formatMap[ext] || ext;
};

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const resourceType = getResourceType(file.originalname);
    const fileFormat = getFileFormat(file.originalname);
    const subjectId = req.body.subjectId || req.params.assignmentId || 'general';
    const folder = `etab_assignments/${subjectId}`;
    
    console.log('[Cloudinary Upload]', {
      filename: file.originalname,
      format: fileFormat,
      resourceType: resourceType,
      folder: folder
    });
    
    return {
      folder: folder,
      resource_type: resourceType,
      format: fileFormat,
      allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'odt', 'mp4', 'webm', 'mov', 'avi', 'zip', 'rar', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'mkv']
    };
  }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  const allowedMimetypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/rtf',
    'application/rtf',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi'
  ];
  
  // Also allow files without mimetype that have valid extensions
  const validExts = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|rtf|odt|zip|rar|jpg|jpeg|png|gif|webp|svg|bmp|mp4|webm|mov|avi|mkv)$/i;
  const hasValidExtension = validExts.test(file.originalname);
  
  if (allowedMimetypes.includes(file.mimetype) || hasValidExtension) {
    cb(null, true);
  } else {
    console.log('[File Filter Rejected]', file.originalname, file.mimetype);
    cb(new Error(`File type not allowed: ${file.mimetype || 'unknown'}. Allowed: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, JPG, PNG, MP4, ZIP`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: fileFilter
});

const handleUpload = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        console.error('[Upload Error]', err);
        return res.status(400).json({ 
          success: false, 
          message: err.message || 'File upload failed',
          error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 100MB)' : err.message
        });
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
  cloudinary,
  getResourceType,
  getFileFormat
};