import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  ClipboardList, 
  HelpCircle, 
  BookOpen, 
  Bell,
  LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LearnerNavigation = () => {
  const { logout, user } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/progress', label: 'My Progress', icon: TrendingUp },
    { path: '/assignments', label: 'Assignments', icon: ClipboardList },
    { path: '/quizzes', label: 'Quizzes', icon: HelpCircle },
    { path: '/subjects', label: 'My Subjects', icon: BookOpen },
    { path: '/notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <aside className="w-64 bg-white h-screen shadow-lg flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-blue-600">E-Tab</h1>
        <p className="text-sm text-gray-500">Learning Portal</p>
      </div>

      {/* User Info */}
      <div className="p-4 border-b">
        <p className="font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
        <p className="text-sm text-gray-500">{user?.email}</p>
        <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
          Learner
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default LearnerNavigation;
