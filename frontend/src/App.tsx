import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { KioskLayout } from './features/kiosk/KioskLayout';
import { TeacherLayout } from './features/teacher/TeacherLayout';
import { LoginPage } from './features/teacher/LoginPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/kiosk" element={<KioskLayout />} />
          <Route path="/teacher/login" element={<LoginPage />} />
          <Route
            path="/teacher/*"
            element={
              <ProtectedRoute>
                <TeacherLayout />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
