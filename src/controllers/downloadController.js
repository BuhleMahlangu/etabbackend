const db = require('../config/database');
const https = require('https');
const http = require('http');
const url = require('url');

// ============================================
// PROXY DOWNLOAD - Download from Cloudinary with proper filename
// ============================================
const proxyDownload = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get material details
    const result = await db.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
              mod.name as subject_name
       FROM materials m 
       JOIN users u ON m.uploaded_by = u.id 
       JOIN modules mod ON m.subject_id = mod.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const material = result.rows[0];

    // Check access permissions for learners
    if (req.user.role === 'learner') {
      const enrollment = await db.query(
        `SELECT 1 FROM learner_modules 
         WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
        [req.user.userId, material.subject_id]
      );
      
      if (enrollment.rows.length === 0 || !material.is_published) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Increment download count
    await db.query('UPDATE materials SET download_count = download_count + 1 WHERE id = $1', [id]);

    // Determine filename
    const originalFilename = material.original_filename || material.title;
    const filename = originalFilename.includes('.') 
      ? originalFilename 
      : `${originalFilename}.${getExtensionFromMimeType(material.file_type)}`;

    // Parse the file URL
    const fileUrl = material.file_url;
    const parsedUrl = url.parse(fileUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', material.file_type || 'application/octet-stream');

    // Proxy the file from Cloudinary to the user
    const proxyReq = client.get(fileUrl, (proxyRes) => {
      // Copy content-type if available
      if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
      }
      
      // Copy content-length if available
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }

      // Pipe the response directly to the user
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Download failed' });
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Download failed' });
    }
  }
};

// Helper to get file extension from MIME type
function getExtensionFromMimeType(mimeType) {
  if (!mimeType) return 'bin';
  
  const extensions = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/zip': 'zip',
    'text/plain': 'txt'
  };
  
  return extensions[mimeType] || 'bin';
}

module.exports = { proxyDownload };
