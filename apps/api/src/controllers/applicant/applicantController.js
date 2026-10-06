import { getApplicantProfile, checkApplicantProfile } from "../../services/applicant/applicantService.js";

//Response handler for getting the record of applicant
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

//Response handler for checking wheter the applicant have records
export const getProfileStatus = async (req, res) => {
    try {
        const profileExists = await checkApplicantProfile(req.user.id);

        res.status(200).json({
            profileExists
        });
    } catch (error) {
        console.error("Error checking applicant profile:", error);

        res.status(500).json({
            message: "Failed to check applicant profile"
        });
    }
};