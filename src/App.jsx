import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import OnboardingBanner from './components/OnboardingBanner.jsx'
import { BillingProvider } from './context/BillingContext.jsx'
import { getStoredToken } from './utils/authClient.js'
import CreateDocument from './pages/CreateDocument.jsx'
import Customers from './pages/Customers.jsx'
import History from './pages/History.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Products from './pages/Products.jsx'
import Register from './pages/Register.jsx'
import CompanySettings from './pages/CompanySettings.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Purchases from './pages/Purchases.jsx'
import PurchaseOrders from './pages/PurchaseOrders.jsx'
import PP30 from './pages/PP30.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Pricing from './pages/Pricing.jsx'
import BillingSuccess from './pages/BillingSuccess.jsx'

function ProtectedRoute({ children }) {
  const token = getStoredToken()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <BillingProvider>
      <div className="min-h-svh overflow-x-hidden bg-slate-50">
        <Navbar />
        <main className="app-container pb-8 md:pb-10">
          <OnboardingBanner />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <CreateDocument />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company-settings"
              element={
                <ProtectedRoute>
                  <CompanySettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing"
              element={
                <ProtectedRoute>
                  <Pricing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/success"
              element={
                <ProtectedRoute>
                  <BillingSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchases"
              element={
                <ProtectedRoute>
                  <Purchases />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute>
                  <PurchaseOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pp30"
              element={
                <ProtectedRoute>
                  <PP30 />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
      </BillingProvider>
    </BrowserRouter>
  )
}
