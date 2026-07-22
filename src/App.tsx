import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Investment from './pages/Investment';
import Thoughts from './pages/Thoughts';
import Career from './pages/Career';
import Todos from './pages/Todos';
import Projects from './pages/Projects';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="investment/*" element={<Investment />} />
          <Route path="thoughts" element={<Thoughts />} />
          <Route path="thoughts/:category" element={<Thoughts />} />
          <Route path="career" element={<Career />} />
          <Route path="todos/*" element={<Todos />} />
          <Route path="projects" element={<Projects />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
