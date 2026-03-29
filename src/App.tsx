import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Organizations from './pages/Organizations'
import OrganizationDetail from './pages/OrganizationDetail'
import Conversations from './pages/Conversations'

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
        <UnreadMessagesProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations"
            element={
              <ProtectedRoute>
                <Organizations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations/:slug"
            element={
              <ProtectedRoute>
                <OrganizationDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute>
                <Conversations />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </UnreadMessagesProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
