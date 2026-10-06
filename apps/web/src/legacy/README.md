# Legacy mock UI (prototype)

Not routed and not imported by the app. Kept as a visual reference while the sprint slices rebuild each screen with real data in `pages/` + `features/`:

| Legacy | Rebuilt in |
|---|---|
| `pages/ApplicantDashboard.jsx`, `components/dashboard/` (UpcomingInterview, RecentNotifications) | S7 (profile) / S11 (status panel) |
| `pages/MyDocuments.jsx`, `components/myDocuments/` | S7 (documents) |
| `pages/JobVacancies.jsx`, `components/jobVacancies/` | S10 (job list) |

Delete each part once its slice is done. Do not import from here in new code.

Done so far: S6 rebuilt setup — `ResumeUpload` → `components/shared/FileDropzone.jsx`, `ProfileInformation` → `features/profile/ProfileForm.jsx`, `pages/ApplicantSetup.jsx` → `pages/applicant/Setup.jsx`.
