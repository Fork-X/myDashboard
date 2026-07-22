import { Routes, Route, NavLink } from 'react-router-dom';
import { Target, CheckSquare } from 'lucide-react';
import GoalsList from '../components/todos/GoalsList';
import TodoList from '../components/todos/TodoList';

const tabs = [
  { path: '', label: '目标规划', icon: Target },
  { path: 'list', label: 'TODO List', icon: CheckSquare },
];

export default function Todos() {
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
          <Route index element={<GoalsList />} />
          <Route path="list" element={<TodoList />} />
        </Routes>
      </div>
    </div>
  );
}
