import { getAllApplicants } from "../services/applicant.service.js";

export const getApplicants = (req, res) => {
    const Applicant = getAllApplicants();

    res.json(Applicant);
};