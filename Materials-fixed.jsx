// E-tab Materials Page
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { DataTable } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const Materials = () => {
  const { subjectId } = useParams();
  const { hasRole, token } = useAuth();
  const { addToast } = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadWeek, setUploadWeek] = useState('1');
  const [uploadStatus, setUploadStatus] = useState('published');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMaterials();
  }, [subjectId]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/materials${subjectId ? `?subjectId=${subjectId}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMaterials(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
      // Fallback to empty array
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleClickDropzone = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      addToast('Please select a file', 'error');
      return;
    }
    
    if (!uploadTitle.trim()) {
      addToast('Please enter a title', 'error');
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('subjectId', subjectId || '');
      formData.append('gradeId', ''); // You may need to get this from context or props
      formData.append('title', uploadTitle);
      formData.append('weekNumber', uploadWeek);
      formData.append('isPublished', uploadStatus === 'published');

      const response = await fetch(`${API_URL}/materials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        addToast('Material uploaded successfully!', 'success');
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadTitle('');
        fetchMaterials();
      } else {
        addToast(data.message || 'Upload failed', 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      addToast('Upload failed: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (material) => {
    addToast(`Downloading ${material.title}...`, 'info');
    if (material.file_url) {
      window.open(material.file_url, '_blank');
    }
  };

  const columns = [
    { 
      key: 'title', 
      title: 'Material',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl">
            {row.file_type === 'pdf' ? '📄' : 
             row.file_type === 'mp4' || row.file_type === 'video' ? '🎬' : '📝'}
          </div>
          <div>
            <p className="font-medium text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">
              {(row.file_size_bytes / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )
    },
    { key: 'week_number', title: 'Week', render: (v) => v ? `Week ${v}` : '-' },
    { 
      key: 'is_published', 
      title: 'Status',
      render: (v) => (
        <Badge variant={v ? 'success' : 'warning'}>
          {v ? 'Published' : 'Draft'}
        </Badge>
      )
    },
    { key: 'download_count', title: 'Downloads', render: (v) => v || 0 },
    { 
      key: 'created_at', 
      title: 'Uploaded',
      render: (v) => v ? new Date(v).toLocaleDateString() : '-'
    },
    {
      key: 'actions',
      title: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleDownload(row)}>
            Download
          </Button>
          {hasRole(['teacher', 'admin']) && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedMaterial(row)}>
              Edit
            </Button>
          )}
        </div>
      )
    }
  ];

  const weeks = [...new Set(materials.map(m => m.week_number).filter(Boolean))].sort((a, b) => a - b);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Course Materials</h1>
          <p className="text-slate-500 mt-1">Access and manage learning resources</p>
        </div>
        {hasRole(['teacher', 'admin']) && (
          <Button 
            onClick={() => {
              setSelectedFile(null);
              setUploadTitle('');
              setIsUploadModalOpen(true);
            }} 
            leftIcon="+"
          >
            Upload Material
          </Button>
        )}
      </div>

      {/* Week Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium whitespace-nowrap">
          All Weeks
        </button>
        {weeks.map(week => (
          <button 
            key={week}
            className="px-4 py-2 rounded-full bg-white text-slate-600 text-sm font-medium border border-slate-200 hover:bg-slate-50 whitespace-nowrap"
          >
            Week {week}
          </button>
        ))}
      </div>

      {/* Materials List */}
      <Card>
        <CardHeader>
          <CardTitle>All Materials ({materials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-4xl mb-3">📁</p>
              <p>No materials uploaded yet</p>
              {hasRole(['teacher', 'admin']) && (
                <Button 
                  className="mt-4" 
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  Upload First Material
                </Button>
              )}
            </div>
          ) : (
            <DataTable 
              columns={columns} 
              data={materials}
              onRowClick={(row) => setSelectedMaterial(row)}
            />
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        title="Upload New Material"
        description="Add a new learning resource to this subject"
        size="lg"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.webm,.zip"
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input 
              type="text" 
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2" 
              placeholder="Enter material title"
              required 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Week</label>
              <select 
                value={uploadWeek}
                onChange={(e) => setUploadWeek(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select 
                value={uploadStatus}
                onChange={(e) => setUploadStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* File Dropzone - NOW WITH CLICK HANDLER */}
          <div 
            onClick={handleClickDropzone}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-colors duration-200
              ${selectedFile 
                ? 'border-green-500 bg-green-50' 
                : 'border-slate-300 hover:border-blue-400 bg-slate-50'
              }
            `}
          >
            {selectedFile ? (
              <div>
                <p className="text-green-600 font-medium text-lg">✓ {selectedFile.name}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="text-red-500 text-sm mt-2 hover:underline"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-3">📁</p>
                <p className="text-slate-600 font-medium">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Supports PDF, DOC, MP4, up to 100MB
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button"
              variant="secondary" 
              onClick={() => setIsUploadModalOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={!selectedFile || !uploadTitle.trim() || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Material'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
