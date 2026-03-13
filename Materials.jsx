// E-tab Materials Page - FIXED VERSION
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
  const { subjectId: urlSubjectId } = useParams();
  const { hasRole } = useAuth();
  const { addToast } = useToast();
  const [materials, setMaterials] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadWeek, setUploadWeek] = useState('1');
  const [uploadStatus, setUploadStatus] = useState('published');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTeacherData();
  }, [urlSubjectId]);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      
      const subjectsRes = await fetch(`${API_URL}/teachers/my-assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (subjectsRes.ok) {
        const subjectsData = await subjectsRes.json();
        if (subjectsData.success) {
          const allSubjects = subjectsData.grades?.flatMap(g => 
            g.subjects?.map(s => ({
              ...s,
              gradeId: g.gradeId,
              gradeName: g.gradeName
            })) || []
          ) || [];
          setSubjects(allSubjects);
          
          if (allSubjects.length > 0) {
            setSelectedSubjectId(allSubjects[0].subjectId);
            setSelectedGradeId(allSubjects[0].gradeId);
          }
        }
      }

      const materialsRes = await fetch(`${API_URL}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json();
        if (materialsData.success) {
          setMaterials(materialsData.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleClickDropzone = () => fileInputRef.current?.click();

  const handleSubjectChange = (e) => {
    const subjectId = e.target.value;
    const subject = subjects.find(s => s.subjectId === subjectId);
    if (subject) {
      setSelectedSubjectId(subjectId);
      setSelectedGradeId(subject.gradeId);
    }
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

    if (!selectedSubjectId || !selectedGradeId) {
      addToast('Please select a subject', 'error');
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('subjectId', selectedSubjectId);
      formData.append('gradeId', selectedGradeId);
      formData.append('title', uploadTitle);
      formData.append('weekNumber', uploadWeek);
      formData.append('isPublished', uploadStatus === 'published');

      const response = await fetch(`${API_URL}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        addToast('Material uploaded successfully!', 'success');
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadTitle('');
        fetchTeacherData();
      } else {
        addToast(data.message || 'Upload failed', 'error');
      }
    } catch (err) {
      addToast('Upload failed: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (material) => {
    addToast(`Downloading ${material.title}...`, 'info');
    if (material.file_url) window.open(material.file_url, '_blank');
  };

  const openUploadModal = () => {
    setSelectedFile(null);
    setUploadTitle('');
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].subjectId);
      setSelectedGradeId(subjects[0].gradeId);
    }
    setIsUploadModalOpen(true);
  };

  const columns = [
    { 
      key: 'title', 
      title: 'Material',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl">
            {row.file_type === 'pdf' ? '📄' : row.file_type === 'mp4' ? '🎬' : '📝'}
          </div>
          <div>
            <p className="font-medium text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">
              {row.file_size_bytes ? (row.file_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : ''}
            </p>
          </div>
        </div>
      )
    },
    { key: 'week_number', title: 'Week', render: (v) => v ? `Week ${v}` : '-' },
    { 
      key: 'is_published', 
      title: 'Status',
      render: (v) => <Badge variant={v ? 'success' : 'warning'}>{v ? 'Published' : 'Draft'}</Badge>
    },
    { key: 'download_count', title: 'Downloads', render: (v) => v || 0 },
    { key: 'created_at', title: 'Uploaded', render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      key: 'actions',
      title: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleDownload(row)}>Download</Button>
          {hasRole(['teacher', 'admin']) && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedMaterial(row)}>Edit</Button>
          )}
        </div>
      )
    }
  ];

  const weeks = [...new Set(materials.map(m => m.week_number).filter(Boolean))].sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
          <p className="text-4xl mb-4">📚</p>
          <h3 className="text-xl font-semibold text-amber-900 mb-2">No Subjects Assigned</h3>
          <p className="text-amber-700">Contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Course Materials</h1>
          <p className="text-slate-500 mt-1">Access and manage learning resources</p>
        </div>
        {hasRole(['teacher', 'admin']) && (
          <Button onClick={openUploadModal} leftIcon="+">Upload Material</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {subjects.map((subject) => (
          <div key={subject.subjectId} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{subject.name}</h3>
                <p className="text-sm text-slate-500">{subject.code}</p>
                <p className="text-sm text-slate-400 mt-1">{subject.gradeName}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedSubjectId(subject.subjectId);
                  setSelectedGradeId(subject.gradeId);
                  openUploadModal();
                }}
                className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg"
              >
                <span className="text-xl">+</span>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
              <span>{subject.enrolledLearners || 0} students</span>
              {subject.isPrimary && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Primary</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium whitespace-nowrap">All Weeks</button>
        {weeks.map(week => (
          <button key={week} className="px-4 py-2 rounded-full bg-white text-slate-600 text-sm font-medium border border-slate-200 hover:bg-slate-50 whitespace-nowrap">
            Week {week}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Materials ({materials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-4xl mb-3">📁</p>
              <p>No materials uploaded yet</p>
              {hasRole(['teacher', 'admin']) && <Button className="mt-4" onClick={openUploadModal}>Upload First Material</Button>}
            </div>
          ) : (
            <DataTable columns={columns} data={materials} onRowClick={(row) => setSelectedMaterial(row)} />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        title="Upload New Material"
        description="Add a new learning resource"
        size="lg"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.webm,.zip" />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
            <select value={selectedSubjectId} onChange={handleSubjectChange} className="w-full rounded-lg border border-slate-300 px-4 py-2" required>
              {subjects.map((subject) => (
                <option key={subject.subjectId} value={subject.subjectId}>{subject.name} ({subject.gradeName})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2" placeholder="Enter material title" required />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Week</label>
              <select value={uploadWeek} onChange={(e) => setUploadWeek(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={uploadStatus} onChange={(e) => setUploadStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div onClick={handleClickDropzone} onDrop={handleDrop} onDragOver={handleDragOver} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${selectedFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'}`}>
            {selectedFile ? (
              <div>
                <p className="text-green-600 font-medium text-lg">{selectedFile.name}</p>
                <p className="text-sm text-slate-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-red-500 text-sm mt-2 hover:underline">Remove file</button>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">📁</div>
                <p className="text-slate-600 font-medium">Drop files here or click to browse</p>
                <p className="text-sm text-slate-400 mt-1">Supports PDF, DOC, MP4, up to 100MB</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsUploadModalOpen(false)} disabled={isUploading}>Cancel</Button>
            <Button type="submit" disabled={!selectedFile || !uploadTitle.trim() || isUploading || !selectedSubjectId}>
              {isUploading ? 'Uploading...' : 'Upload Material'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
