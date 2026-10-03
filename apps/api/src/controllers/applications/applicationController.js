import { getApplications as fetchApplications } from "../../services/applications/applicationService.js";

export function getApplications(req, res) {
    const applications = fetchApplications();

    res.json({
        message: "Applicant applications endpoint",
        applications: applications
    });
}