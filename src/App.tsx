import React, { Component, ErrorInfo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import Index from "./pages/Index";
import MedicalReport from "./pages/MedicalReport";
import Analyze from "./pages/Analyze";
import Diagnose from "./pages/Diagnose";
import Habits from "./pages/Habits";
import Dashboard from "./pages/Dashboard";
import Recommendations from "./pages/Recommendations";
import Patients from "./pages/Patients";
import SignInPage from "./pages/SignInPage";

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="glass card-shadow rounded-2xl p-8 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred while loading this page."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="gradient-bg rounded-full px-6 py-2.5 text-xs font-semibold text-primary-foreground"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

function PatientsPageAccess() {
  const { user } = useUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  const ALLOWED_EMAILS = [
    "yusufusmani910@gmail.com",
    "areebimam466@gmail.com",
    "omsh0401@gmail.com",
    "areebimam455@gmail.com"
  ];

  if (!ALLOWED_EMAILS.includes(userEmail)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Patients />;
}
const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Index />} />
        <Route path="/sign-in" element={<SignInPage />} />

        {/* Protected */}
        <Route path="/medical-report" element={<ProtectedRoute><MedicalReport /></ProtectedRoute>} />
        <Route path="/analyze" element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
        <Route path="/diagnose" element={<ProtectedRoute><Diagnose /></ProtectedRoute>} />
        <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
        <Route path="/patients" element={
          <ProtectedRoute>
            <PatientsPageAccess />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
