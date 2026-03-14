import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  ClipboardList, 
  HelpCircle, 
  TrendingUp, 
  Bell, 
  Calendar,
  Clock,
  FileText,
  ChevronRight,
  Award
} from 'lucide-react';
import { progressAPI, assignmentAPI, quizAPI, notificationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const LearnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overallGrade: 'N/A',
    overallPercentage: 0,
    pendingAssignments: 0,
    upcomingQuizzes: 0,
    unreadNotifications: 0,
    recentActivity: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch progress data
      const progressRes = await progressAPI.getMyProgress();
      const assignmentsRes = await assignmentAPI.getMyAssignments();
      const deadlinesRes = await assignmentAPI.getUpcomingDeadlines();
      const notificationsRes = await notificationAPI.getMyNotifications();

      if (progressRes.success) {
        setStats({
          overallGrade: progressRes.data.overall.overallGrade,
          overallPercentage: progressRes.data.overall.overallPercentage,
          pendingAssignments: progressRes.data.overall.totalAssignments - progressRes.data.overall.submittedAssignments,
          upcomingDeadlines: deadlinesRes.data?.length || 0,
          unreadNotifications: notificationsRes.data?.filter(n => !n.is_read).length || 0,
          recentActivity: progressRes.data.recentActivity?.slice(0, 5) || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    {
      title: 'My Progress',
      description: 'View your grades and performance',
      icon: TrendingUp,
      color: 'bg-blue-500',
      path: '/progress',
      stat: `${stats.overallPercentage}%`
    },
    {
      title: 'Assignments',
      description: 'View and submit assignments',
      icon: ClipboardList,
      color: 'bg-green-500',
      path: '/assignments',
      stat: `${stats.pendingAssignments} pending`
    },
    {
      title: 'Quizzes',
      description: 'Take quizzes and view results',
      icon: HelpCircle,
      color: 'bg-purple-500',
      path: '/quizzes',
      stat: 'View all'
    },
    {
      title: 'My Subjects',
      description: 'Access learning materials',
      icon: BookOpen,
      color: 'bg-orange-500',
      path: '/subjects',
      stat: 'Browse'
    }
  ];

  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return 'text-green-600';
    if (grade === 'B') return 'text-blue-600';
    if (grade === 'C') return 'text-yellow-600';
    if (grade === 'D') return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.first_name || 'Learner'}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here's what's happening with your studies
        </p>
      </div>

      {/* Overall Grade Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-1">Your Overall Performance</p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold">{stats.overallGrade}</span>
              <span className="text-2xl text-blue-200">({stats.overallPercentage}%)</span>
            </div>
            <p className="text-blue-100 mt-2">
              Keep up the good work! Check your detailed progress below.
            </p>
          </div>
          <Award className="w-20 h-20 text-blue-200 opacity-50" />
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickLinks.map((link) => (
          <div
            key={link.title}
            onClick={() => navigate(link.path)}
            className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className={`${link.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
              <link.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{link.title}</h3>
            <p className="text-sm text-gray-500 mb-3">{link.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-600">{link.stat}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Recent Activity
            </h2>
            <button 
              onClick={() => navigate('/progress')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all
            </button>
          </div>
          <div className="divide-y">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity, index) => (
                <div key={index} className="p-4 flex items-start">
                  <div className={`p-2 rounded-lg mr-3 ${
                    activity.type === 'assignment_graded' 
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.type === 'assignment_graded' ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <HelpCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.subject_name}</p>
                    <div className="flex items-center mt-1">
                      <span className={`text-sm font-bold ${
                        (activity.percentage || (activity.marks_obtained / activity.max_marks * 100)) >= 50 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {activity.percentage !== undefined 
                          ? `${activity.percentage.toFixed ? activity.percentage.toFixed(1) : activity.percentage}%`
                          : `${activity.marks_obtained}/${activity.max_marks}`
                        }
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(activity.activity_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No recent activity yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {/* Pending Assignments */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-orange-100 p-3 rounded-lg mr-4">
                  <ClipboardList className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Pending Assignments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingAssignments}</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/assignments')}
                className="text-blue-600 text-sm hover:underline"
              >
                View
              </button>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-red-100 p-3 rounded-lg mr-4">
                  <Calendar className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Upcoming Deadlines</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingDeadlines}</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/assignments')}
                className="text-blue-600 text-sm hover:underline"
              >
                View
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-blue-100 p-3 rounded-lg mr-4">
                  <Bell className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Unread Notifications</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unreadNotifications}</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/notifications')}
                className="text-blue-600 text-sm hover:underline"
              >
                View
              </button>
            </div>
          </div>

          {/* Progress Link */}
          <div 
            onClick={() => navigate('/progress')}
            className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white/20 p-3 rounded-lg mr-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-green-100 text-sm">View Detailed Progress</p>
                  <p className="font-semibold">Check all grades & performance</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnerDashboard;
