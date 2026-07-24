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
        <div className="mb-6 border-b-2 border-dashed border-vintage-border pb-2">
          <nav className="flex gap-4">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === ''}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 transition-colors border-2 rounded ${
                    isActive
                      ? 'bg-vintage-red text-white border-vintage-red'
                      : 'border-dashed border-vintage-border text-vintage-dark hover:bg-white'
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
