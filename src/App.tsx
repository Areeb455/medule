import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import Index from "./pages/Index";
import Analyze from "./pages/Analyze";
import Diagnose from "./pages/Diagnose";
import Habits from "./pages/Habits";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import SignInPage from "./pages/SignInPage";
import NotFound from "./pages/NotFound";

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

const App = () => (
  <BrowserRouter>
    <Routes>
      {/* Public */}
      <Route path="/"         element={<Index />} />
      <Route path="/sign-in"  element={<SignInPage />} />

      {/* Protected */}
      <Route path="/analyze"   element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
      <Route path="/diagnose"  element={<ProtectedRoute><Diagnose /></ProtectedRoute>} />
      <Route path="/habits"    element={<ProtectedRoute><Habits /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/patients"  element={<ProtectedRoute><Patients /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
