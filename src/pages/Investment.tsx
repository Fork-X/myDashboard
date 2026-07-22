import { Routes, Route, NavLink } from 'react-router-dom';
import { BookOpen, Calendar, Newspaper } from 'lucide-react';
import KnowledgeList from '../components/investment/KnowledgeList';
import ReviewTimeline from '../components/investment/ReviewTimeline';
import NewsList from '../components/investment/NewsList';

const tabs = [
  { path: '', label: '投资知识', icon: BookOpen },
  { path: 'review', label: '每日复盘', icon: Calendar },
  { path: 'news', label: '热点消息', icon: Newspaper },
];

export default function Investment() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === ''}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`
                }
              >
                <tab.icon size={18} />
                <span className="font-medium">{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <Routes>
          <Route index element={<KnowledgeList />} />
          <Route path="review" element={<ReviewTimeline />} />
          <Route path="news" element={<NewsList />} />
        </Routes>
      </div>
    </div>
  );
}
