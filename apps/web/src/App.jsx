import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "./pages/login/LoginPage";
import ApplicantDashboard from "./pages/Applicant/ApplicantDashboard";
import JobVacancies from "./pages/Applicant/JobVacancies";
import MyDocuments from "./pages/Applicant/MyDocuments";
import ProtectedRoute from "./components/ProtectedRoute";
import ApplicantSetup from "./pages/Applicant/ApplicantSetup"

import "./styles/global.css";
import "./styles/login.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
              <LoginPage />
        }
        />

        <Route
          path="/applicant"
          element={
            <ProtectedRoute>
              <ApplicantDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/applicant/setup"
          element={
            <ProtectedRoute>
              <ApplicantSetup />
            </ProtectedRoute>
          }
        />

        <Route
          path="/applicant/jobs"
          element={
            <ProtectedRoute>
              <JobVacancies />
            </ProtectedRoute>
              
          }
        />

        <Route
          path="/applicant/documents"
          element={
            <ProtectedRoute>
              <MyDocuments />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;