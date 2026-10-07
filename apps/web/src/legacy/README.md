# Legacy mock UI (prototype)

Not routed and not imported by the app. Kept as a visual reference while the sprint slices rebuild each screen with real data in `pages/` + `features/`:

| Legacy | Rebuilt in |
|---|---|
| `components/dashboard/UpcomingInterview.jsx` | S13 (interview pop-up) |

Delete each part once its slice is done. Do not import from here in new code.

Done so far:
- S6 setup: `ResumeUpload` → `components/shared/FileDropzone.jsx`, `ProfileInformation` → `features/profile/ProfileForm.jsx`, `pages/ApplicantSetup.jsx` → `pages/applicant/Setup.jsx`.
- S7: `ApplicantDashboard` → `pages/applicant/Dashboard.jsx` + `features/profile/ProfileCard.jsx`; `MyDocuments`, `DocumentTable`, `UploadDocumentModal` → `pages/applicant/Documents.jsx`, `features/documents/DocumentTable.jsx`, `features/documents/UploadDocumentDialog.jsx`.
- S10: `JobVacancies` page and `jobCards/*` (JobDetailsModal, JobDetailsHeader, JobDescription, JobQualifications, JobResponsibilities) → `pages/applicant/Jobs.jsx`, `pages/applicant/JobDetailPage.jsx`, `features/jobs/JobCard.jsx`, `JobDetail.jsx`, `JobSection.jsx`.
- S11: `jobVacancies/Application/*` (ApplicationModal, ApplicationHeader, ApplicationActions; `ResumeUpload` document selection dropped for the applicant-type radio button, UI_GUIDELINES §9) → `features/applications/ApplyDialog.jsx`; `dashboard/RecentNotifications.jsx` → `features/notifications/RecentNotifications.jsx` + `NotificationList.jsx`.
