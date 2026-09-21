import { testService } from "../services/test.service.js";
import { getAllApplicants } from "../services/applicant.service.js";

export const testController = (req, res) => {
    const result = testService();

    res.json(result);

};

export const Applicants = (req, res) => {
    const applicant = getAllApplicants();

    res.json(applicant);
};

export const anotherTest = (req, res) => {
    res.json({
        message:"You connected to this route"
    });
};


