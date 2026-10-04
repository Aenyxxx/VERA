import express from "express";

import { authenticate } from "../../middleware/authMiddleware.js";
import { getProfile } from "../../controllers/applicant/applicantController.js";

const router = express.Router();

router.get("/profile", authenticate, getProfile);

export default router;