import express from "express";
import { getApplicants } from "../controllers/applicant.controller.js";


const router = express.Router();

router.post("/applicants", getApplicants);

export default router;
