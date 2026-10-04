import express from "express";
import multer from "multer";

import { authenticate } from "../../middleware/authMiddleware.js";
import { getProfile, getProfileStatus } from "../../controllers/applicant/applicantController.js";
import { uploadResume } from "../../controllers/applicant/resumeController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

//Endpoints to check wheter the user have profile records in supa.
router.get(
    "/profile/status",
    authenticate,
    getProfileStatus
)

//Endpoints to get the profile from the supabase
router.get(
  "/profile",
  authenticate,
  getProfile
);

//endpoint to send resume and to process it.
router.post(
  "/resume",
  authenticate,
  upload.single("resume"),
  uploadResume
);

export default router;