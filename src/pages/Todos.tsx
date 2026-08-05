import { Routes, Route, NavLink } from 'react-router-dom';
import { Target, CheckSquare } from 'lucide-react';
import GoalsList from '../components/todos/GoalsList';
import TodoList from '../components/todos/TodoList';

const tabs = [
  { path: '', label: '持续目标', icon: Target },
  { path: 'list', label: 'TODO 四象限', icon: CheckSquare },
];

export default function Todos() {
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
          <Route index element={<GoalsList />} />
          <Route path="list" element={<TodoList />} />
        </Routes>
      </div>
    </div>
  );
}
