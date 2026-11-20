import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  Home,
  Login,
  ForgotPassword,
  ResetPassword,
  Dashboard,
  RequestList,
  RequestDetail,
  LaborList,
  AuditLog,
  LaborDetail,
  Admin,
  Account,
  Vendors,
  VendorDetail,
} from '@/pages'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/requests" element={<RequestList />} />
        <Route path="/requests/new" element={<Navigate to="/requests?new=request" replace />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/labor" element={<LaborList />} />
        <Route path="/labor/:id" element={<LaborDetail />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendors/:id" element={<VendorDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/:tab" element={<Admin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/audit" element={<AuditLog />} />
      </Route>
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <Account forcePasswordChange />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
