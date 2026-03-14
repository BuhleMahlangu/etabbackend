import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Award, 
  AlertCircle,
  ChevronRight,
  FileText,
  HelpCircle,
  BarChart3,
  Calendar,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const LearnerProgress = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectDetail, setSubjectDetail] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please log in.');
        setLoading(false);
        return;
      }

      console.log('[Progress] Fetching from:', `${API_URL}/progress/my-progress`);
      
      const response = await axios.get(`${API_URL}/progress/my-progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('[Progress] Response:', response.data);
      setDebugInfo(JSON.stringify(response.data, null, 2));

      if (response.data.success) {
        setProgressData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to load progress');
      }
    } catch (err) {
      console.error('[Progress] Error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load progress data');
      setDebugInfo(JSON.stringify({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status
      }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectDetail = async (subjectId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/progress/subject/${subjectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSubjectDetail(response.data.data);
        setSelectedSubject(subjectId);
      }
    } catch (err) {
      console.error('Failed to load subject detail:', err);
      alert('Failed to load subject details: ' + (err.response?.data?.message || err.message));
    }
  };

  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return 'text-green-600 bg-green-100';
    if (grade === 'B') return 'text-blue-600 bg-blue-100';
    if (grade === 'C') return 'text-yellow-600 bg-yellow-100';
    if (grade === 'D') return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
          <AlertCircle className="inline-block w-5 h-5 mr-2" />
          {error}
        </div>
        <button 
          onClick={fetchProgress}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
        {debugInfo && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600">Debug Info</summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">{debugInfo}</pre>
          </details>
        )}
      </div>
    );
  }

  // No data state
  if (!progressData || !progressData.subjects || progressData.subjects.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">My Academic Progress</h1>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <BookOpen className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Progress Data Yet</h2>
          <p className="text-gray-600 mb-4">
            You don't have any enrolled subjects or graded assignments yet.
          </p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => navigate('/subjects')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Browse Subjects
            </button>
            <button 
              onClick={fetchProgress}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {progressData?.overall && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm text-gray-500">Subjects</p>
              <p className="text-2xl font-bold">{progressData.overall.totalSubjects}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm text-gray-500">Assignments</p>
              <p className="text-2xl font-bold">{progressData.overall.totalAssignments}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm text-gray-500">Graded</p>
              <p className="text-2xl font-bold">{progressData.overall.gradedAssignments}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm text-gray-500">Quizzes</p>
              <p className="text-2xl font-bold">{progressData.overall.totalQuizzes}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { overall, subjects, recentActivity } = progressData;

  // Subject Detail View
  if (selectedSubject && subjectDetail) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button
          onClick={() => {
            setSelectedSubject(null);
            setSubjectDetail(null);
          }}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Progress Overview
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{subjectDetail.subject.name}</h1>
              <p className="text-gray-500">{subjectDetail.subject.code}</p>
            </div>
            <div className="text-right">
              <div className={`inline-block px-4 py-2 rounded-lg font-bold text-lg ${getGradeColor(subjectDetail.summary.letterGrade)}`}>
                {subjectDetail.summary.letterGrade}
              </div>
              <p className="text-sm text-gray-500 mt-1">{subjectDetail.summary.overallPercentage}% Overall</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Assignments</p>
            <p className="text-2xl font-bold text-gray-900">{subjectDetail.assignments.stats.percentage}%</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Quiz Average</p>
            <p className="text-2xl font-bold text-gray-900">{subjectDetail.quizzes.stats.averagePercentage}%</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Status</p>
            <p className={`text-lg font-bold ${subjectDetail.summary.status === 'Passing' ? 'text-green-600' : 'text-red-600'}`}>
              {subjectDetail.summary.status}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-orange-600">
              {subjectDetail.assignments.stats.total - subjectDetail.assignments.stats.submitted}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Assignments
              </h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {subjectDetail.assignments.items.map((assignment) => (
                <div key={assignment.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{assignment.title}</p>
                      <p className="text-sm text-gray-500">Max Marks: {assignment.maxMarks}</p>
                    </div>
                    <div className="text-right">
                      {assignment.submission?.status === 'graded' ? (
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {assignment.submission.marksObtained}
                            <span className="text-sm text-gray-500">/{assignment.maxMarks}</span>
                          </p>
                          <p className="text-sm text-green-600 font-medium">{assignment.submission.percentage}%</p>
                        </div>
                      ) : assignment.submission ? (
                        <span className="text-sm text-yellow-600">Pending Grade</span>
                      ) : (
                        <span className="text-sm text-red-600">Not Submitted</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center">
                <HelpCircle className="w-5 h-5 mr-2" />
                Quizzes
              </h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {subjectDetail.quizzes.items.map((quiz) => (
                <div key={quiz.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{quiz.title}</p>
                    </div>
                    <div className="text-right">
                      {quiz.attempt?.status === 'completed' ? (
                        <div>
                          <p className={`text-2xl font-bold ${quiz.attempt.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {quiz.attempt.percentage}%
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            quiz.attempt.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {quiz.attempt.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not Attempted</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Overview
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Academic Progress</h1>
        <p className="text-gray-500 mt-1">Track your performance across all subjects</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Overall Grade</p>
              <p className="text-4xl font-bold">{overall.overallGrade}</p>
            </div>
            <Award className="w-12 h-12 text-blue-200" />
          </div>
          <p className="mt-2 text-blue-100">{overall.overallPercentage}% Average</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-500 text-sm">Subjects</p>
          <p className="text-3xl font-bold text-gray-900">{overall.totalSubjects}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-500 text-sm">Assignments</p>
          <p className="text-3xl font-bold text-gray-900">
            {overall.gradedAssignments}/{overall.totalAssignments}
          </p>
          <p className="text-sm text-gray-400">{overall.assignmentAverage}% Avg</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-500 text-sm">Quizzes</p>
          <p className="text-3xl font-bold text-gray-900">
            {overall.completedQuizzes}/{overall.totalQuizzes}
          </p>
          <p className="text-sm text-gray-400">{overall.quizAverage}% Avg</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Subject Progress */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Subject Progress
          </h2>
          
          <div className="space-y-4">
            {subjects.map((subject) => (
              <div 
                key={subject.subjectId}
                onClick={() => fetchSubjectDetail(subject.subjectId)}
                className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{subject.subjectName}</h3>
                    <p className="text-sm text-gray-500">{subject.subjectCode}</p>
                  </div>
                  <div className="flex items-center">
                    <span className={`px-3 py-1 rounded-full font-bold mr-3 ${getGradeColor(subject.letterGrade)}`}>
                      {subject.letterGrade}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Overall Progress</span>
                    <span className="font-medium text-gray-900">{subject.overallPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(subject.overallPercentage)}`}
                      style={{ width: `${Math.min(subject.overallPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500">Assignments</p>
                    <p className="font-semibold text-gray-900">
                      {subject.assignments.submitted}/{subject.assignments.total}
                      <span className="text-xs text-gray-400 ml-1">({subject.assignments.percentage}%)</span>
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500">Quizzes</p>
                    <p className="font-semibold text-gray-900">
                      {subject.quizzes.completed}/{subject.quizzes.total}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500">Pending</p>
                    <p className="font-semibold text-orange-600">{subject.assignments.pending}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl shadow-sm">
            {recentActivity && recentActivity.length > 0 ? (
              <div className="divide-y">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="p-4">
                    <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.subject_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnerProgress;
