import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LocationsProvider } from './contexts/LocationsContext';
import { Layout } from './components/Layout';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { DailyJobPage } from './pages/DailyJobPage';
import { GhlStatusPage } from './pages/GhlStatusPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { OverviewPage } from './pages/OverviewPage';
import { PostsPage } from './pages/PostsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <LocationsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="posts" element={<PostsPage />} />
            <Route path="daily-job" element={<DailyJobPage />} />
            <Route path="ghl-status" element={<GhlStatusPage />} />
            <Route path="media" element={<MediaLibraryPage />} />
            <Route path="approval" element={<ApprovalQueuePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </LocationsProvider>
    </BrowserRouter>
  );
}
