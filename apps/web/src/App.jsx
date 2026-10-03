import { useState } from "react";

import ApplicantDashboard from "./pages/Applicant/ApplicantDashboard";
import JobVacancies from "./pages/Applicant/JobVacancies";
import MyDocuments from "./pages/Applicant/MyDocuments";

import "./styles/global.css";
import "./styles/login.css";

function App() {
  const [activePage, setActivePage] = useState("profile");

  return (
    <>
      {activePage === "profile" && (
        <ApplicantDashboard
          activePage={activePage}
          onNavigate={setActivePage}
        />
      )}

      {activePage === "jobs" && (
        <JobVacancies
          activePage={activePage}
          onNavigate={setActivePage}
        />
      )}

      {activePage === "documents" && (
        <MyDocuments 
          activePage={activePage}
          onNavigate={setActivePage}
        />
      )}
    </>
  );
}

export default App;