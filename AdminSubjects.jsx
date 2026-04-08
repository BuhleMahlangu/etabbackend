import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  X, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  GraduationCap,
  School
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-right ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span>{message}</span>
    </div>
  );
};

// Modal component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Confirmation Dialog
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertCircle className="text-red-600" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminSubjects = () => {
  // State
  const [subjects, setSubjects] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [expandedPhases, setExpandedPhases] = useState({});
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, subject: null });
  
  // Toast
  const [toast, setToast] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phase: 'FET',
    department: 'General',
    credits: 10,
    applicableGrades: []
  });

  // Available options
  const phases = ['Foundation', 'Intermediate', 'Senior', 'FET'];
  const departments = ['Mathematics', 'Science', 'Languages', 'Technology', 'Arts', 'Humanities', 'Business', 'Services', 'Life Orientation', 'General'];
  const allGrades = [
    { value: '1', label: 'Grade 1' },
    { value: '2', label: 'Grade 2' },
    { value: '3', label: 'Grade 3' },
    { value: '4', label: 'Grade 4' },
    { value: '5', label: 'Grade 5' },
    { value: '6', label: 'Grade 6' },
    { value: '7', label: 'Grade 7' },
    { value: '8', label: 'Grade 8' },
    { value: '9', label: 'Grade 9' },
    { value: '10', label: 'Grade 10' },
    { value: '11', label: 'Grade 11' },
    { value: '12', label: 'Grade 12' },
  ];

  // Get auth token
  const getToken = () => {
    const token = localStorage.getItem('token');
    return token ? token.replace(/^["']|["']$/g, '') : null;
  };

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Fetch subjects
  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/admin/subjects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSubjects(data.subjects || []);
        setFilteredSubjects(data.subjects || []);
        
        // Auto-expand all phases
        const phases = {};
        (data.subjects || []).forEach(subject => {
          phases[subject.phase] = true;
        });
        setExpandedPhases(phases);
      } else {
        throw new Error(data.message || 'Failed to fetch subjects');
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Filter subjects
  useEffect(() => {
    let filtered = subjects;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(term) ||
        s.code?.toLowerCase().includes(term) ||
        s.department?.toLowerCase().includes(term)
      );
    }
    
    if (phaseFilter !== 'all') {
      filtered = filtered.filter(s => s.phase === phaseFilter);
    }
    
    setFilteredSubjects(filtered);
  }, [searchTerm, phaseFilter, subjects]);

  // Group subjects by phase
  const subjectsByPhase = filteredSubjects.reduce((acc, subject) => {
    if (!acc[subject.phase]) acc[subject.phase] = [];
    acc[subject.phase].push(subject);
    return acc;
  }, {});

  // Toggle phase expansion
  const togglePhase = (phase) => {
    setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingSubject(null);
    setFormData({
      code: '',
      name: '',
      phase: 'FET',
      department: 'General',
      credits: 10,
      applicableGrades: []
    });
    setIsModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (subject) => {
    setEditingSubject(subject);
    setFormData({
      code: subject.code?.split('-').pop() || subject.code || '',
      name: subject.name || '',
      phase: subject.phase || 'FET',
      department: subject.department || 'General',
      credits: subject.credits || 10,
      applicableGrades: subject.applicable_grades || []
    });
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle grade checkbox
  const handleGradeChange = (grade) => {
    setFormData(prev => ({
      ...prev,
      applicableGrades: prev.applicableGrades.includes(grade)
        ? prev.applicableGrades.filter(g => g !== grade)
        : [...prev.applicableGrades, grade]
    }));
  };

  // Create subject
  const createSubject = async () => {
    try {
      setIsSubmitting(true);
      const token = getToken();
      
      const payload = {
        code: formData.code,
        name: formData.name,
        phase: formData.phase,
        department: formData.department,
        credits: parseInt(formData.credits),
        applicableGrades: formData.applicableGrades
      };

      console.log('Creating subject with payload:', payload);

      const response = await fetch(`${API_URL}/admin/subjects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('Subject created successfully');
        setIsModalOpen(false);
        fetchSubjects();
      } else {
        throw new Error(data.message || 'Failed to create subject');
      }
    } catch (err) {
      console.error('Error creating subject:', err);
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update subject
  const updateSubject = async () => {
    try {
      setIsSubmitting(true);
      const token = getToken();
      
      const payload = {
        name: formData.name,
        department: formData.department,
        credits: parseInt(formData.credits),
        applicableGrades: formData.applicableGrades
      };

      const response = await fetch(`${API_URL}/admin/subjects/${editingSubject.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('Subject updated successfully');
        setIsModalOpen(false);
        fetchSubjects();
      } else {
        throw new Error(data.message || 'Failed to update subject');
      }
    } catch (err) {
      console.error('Error updating subject:', err);
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete subject
  const deleteSubject = async () => {
    try {
      const token = getToken();
      
      const response = await fetch(`${API_URL}/admin/subjects/${deleteDialog.subject.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('Subject deleted successfully');
        setDeleteDialog({ isOpen: false, subject: null });
        fetchSubjects();
      } else {
        throw new Error(data.message || 'Failed to delete subject');
      }
    } catch (err) {
      console.error('Error deleting subject:', err);
      showToast(err.message, 'error');
    }
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSubject) {
      updateSubject();
    } else {
      createSubject();
    }
  };

  // Get phase color
  const getPhaseColor = (phase) => {
    const colors = {
      'Foundation': 'bg-green-100 text-green-800',
      'Intermediate': 'bg-blue-100 text-blue-800',
      'Senior': 'bg-purple-100 text-purple-800',
      'FET': 'bg-orange-100 text-orange-800'
    };
    return colors[phase] || 'bg-gray-100 text-gray-800';
  };

  if (loading && subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="text-blue-600" size={32} />
              Manage Subjects
            </h1>
            <p className="text-gray-600 mt-1">
              {subjects.length} subjects across all phases
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Add Subject
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search subjects by name, code, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="text-gray-400" size={20} />
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Phases</option>
                {phases.map(phase => (
                  <option key={phase} value={phase}>{phase}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="text-red-600" size={24} />
            <div>
              <h3 className="font-medium text-red-900">Error loading subjects</h3>
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchSubjects}
              className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredSubjects.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BookOpen className="mx-auto text-gray-300 mb-4" size={64} />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No subjects found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || phaseFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first subject'}
            </p>
            <button
              onClick={openCreateModal}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Subject
            </button>
          </div>
        )}

        {/* Subjects by Phase */}
        {Object.entries(subjectsByPhase).sort().map(([phase, phaseSubjects]) => (
          <div key={phase} className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
            <button
              onClick={() => togglePhase(phase)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(phase)}`}>
                  {phase}
                </span>
                <span className="text-gray-600">
                  {phaseSubjects.length} subject{phaseSubjects.length !== 1 ? 's' : ''}
                </span>
              </div>
              {expandedPhases[phase] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {expandedPhases[phase] && (
              <div className="divide-y">
                {phaseSubjects.map(subject => (
                  <div key={subject.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">{subject.name}</h3>
                          <code className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                            {subject.code}
                          </code>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                            {subject.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <GraduationCap size={16} />
                            Credits: {subject.credits}
                          </span>
                          {subject.applicable_grades?.length > 0 && (
                            <span>
                              Grades: {subject.applicable_grades.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(subject)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit subject"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ isOpen: true, subject })}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete subject"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Create New Subject'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {!editingSubject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Code *
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="e.g., MATH-FET"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                School prefix will be added automatically (e.g., KHS-MATH-FET)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Mathematics"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {!editingSubject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase *
              </label>
              <select
                name="phase"
                value={formData.phase}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {phases.map(phase => (
                  <option key={phase} value={phase}>{phase}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credits
            </label>
            <input
              type="number"
              name="credits"
              value={formData.credits}
              onChange={handleChange}
              min="1"
              max="100"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicable Grades
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {allGrades.map(grade => (
                <label key={grade.value} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.applicableGrades.includes(grade.value)}
                    onChange={() => handleGradeChange(grade.value)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{grade.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={18} />}
              {editingSubject ? 'Update Subject' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, subject: null })}
        onConfirm={deleteSubject}
        title="Delete Subject"
        message={`Are you sure you want to delete "${deleteDialog.subject?.name}"? This action cannot be undone.`}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default AdminSubjects;
