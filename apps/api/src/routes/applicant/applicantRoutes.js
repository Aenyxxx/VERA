import express from "express";
import multer from "multer";

import { authenticate } from "../../middleware/authMiddleware.js";
import { getProfile } from "../../controllers/applicant/applicantController.js";
import { uploadResume } from "../../controllers/applicant/resumeController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.get(
  "/profile",
  authenticate,
  getProfile
);

router.post(
  "/resume",
  authenticate,
  upload.single("resume"),
  uploadResume
);

export default router;