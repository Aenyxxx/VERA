import { getApplicantProfile } from "../../services/applicant/applicantService.js";

export const getProfile = async (req, res) => {
    try {
        const applicant = await getApplicantProfile(req.user.id);

        if (!applicant) {
            return res.status(404).json({
                message: "Applicant profile not found"
            });
        }

        res.status(200).json({
            applicant
        });
    } catch (error) {
        console.error("Error fetching applicant profile:", error);

        res.status(500).json({
            message: "Failed to fetch applicant profile"
        });
    }
};