import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import UserProfile from './pages/UserProfile'
import Organizations from './pages/Organizations'
import OrganizationDetail from './pages/OrganizationDetail'
import Conversations from './pages/Conversations'
import Events from './pages/Events'
import EventVideo from './pages/EventVideo'
import SearchPage from './pages/SearchPage'
import PostDetail from './pages/PostDetail'
import Classes from './pages/Classes'
import ClassCourseDetail from './pages/ClassCourseDetail'
import ExternalLinkGate from './components/ExternalLinkGate'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import ReportBug from './pages/ReportBug'
import AdminBugReports from './pages/AdminBugReports'
import FloatingBugReportButton from './components/FloatingBugReportButton'

function App() {
  return (
    <Router>
      <ExternalLinkGate />
      <AuthProvider>
        <NotificationProvider>
          <UnreadMessagesProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<Layout />}>
                <Route path="user/:userId" element={<UserProfile />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="p/:postId" element={<PostDetail />} />
                <Route path="legal/tos" element={<TermsOfService />} />
                <Route path="legal/privacy" element={<PrivacyPolicy />} />
                <Route path="report" element={<ReportBug />} />
                <Route element={<ProtectedRoute />}>
                  <Route index element={<Dashboard />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="profile" element={<Navigate to="/settings" replace />} />
                  <Route path="organizations" element={<Organizations />} />
                  <Route path="organizations/:slug" element={<OrganizationDetail />} />
                  <Route path="conversations" element={<Conversations />} />
                  <Route path="events" element={<Events />} />
                  <Route path="events/watch/:videoId" element={<EventVideo />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="classes/:courseId" element={<ClassCourseDetail />} />
                  <Route element={<AdminRoute />}>
                    <Route path="admin/reports" element={<AdminBugReports />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <FloatingBugReportButton />
          </UnreadMessagesProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
