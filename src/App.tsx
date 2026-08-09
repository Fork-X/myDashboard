import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Investment from './pages/Investment';
import InvestmentCalendar from './pages/InvestmentCalendar';
import DirectionBoard from './pages/DirectionBoard';
import Inbox from './pages/Inbox';
import Thoughts from './pages/Thoughts';
import Career from './pages/Career';
import Todos from './pages/Todos';
import Projects from './pages/Projects';
import Chat from './pages/Chat';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="investment" element={<Investment />}>
            <Route index element={<InvestmentCalendar />} />
            <Route path="directions" element={<DirectionBoard />} />
            <Route path="inbox" element={<Inbox />} />
          </Route>
          <Route path="thoughts" element={<Thoughts />} />
          <Route path="career" element={<Career />} />
          <Route path="todos/*" element={<Todos />} />
          <Route path="projects" element={<Projects />} />
          <Route path="chats" element={<Chat />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
