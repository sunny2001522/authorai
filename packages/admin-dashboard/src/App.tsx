import { Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { AuthorDashboard } from './pages/AuthorDashboard';

function App() {
  return (
    <Routes>
      {/* Main layout with sidebar */}
      <Route path="/" element={<DashboardLayout />}>
        {/* Root redirects to first author or shows empty state */}
        <Route index element={<AuthorDashboard />} />

        {/* Author specific routes */}
        <Route path=":slug" element={<AuthorDashboard />} />
        <Route path=":slug/conversations" element={<AuthorDashboard />} />
        <Route path=":slug/conversations/:convId" element={<AuthorDashboard />} />
        <Route path=":slug/knowledge" element={<AuthorDashboard />} />
        <Route path=":slug/summary" element={<AuthorDashboard />} />
        <Route path=":slug/dashboard" element={<AuthorDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
