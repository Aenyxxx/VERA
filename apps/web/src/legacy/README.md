# Legacy mock UI (prototype)

Not routed and not imported by the app. Kept as a visual reference while the sprint slices rebuild each screen with real data in `pages/` + `features/`:

| Legacy | Rebuilt in |
|---|---|
| `pages/ApplicantSetup.jsx`, `components/profile/` | S6 (resume setup) |
| `pages/ApplicantDashboard.jsx`, `components/dashboard/` | S7 (profile) / S11 (status panel) |
| `pages/MyDocuments.jsx`, `components/myDocuments/` | S7 (documents) |
| `pages/JobVacancies.jsx`, `components/jobVacancies/` | S10 (job list) |

Delete each part once its slice is done. Do not import from here in new code.
