import { processResume } from "../../services/applicant/resumeService.js";

export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Resume file is required"
      });
    }

    const result = await processResume(req.file);

    res.status(200).json(result);

  } catch (error) {
    console.error("Error processing resume:", error);

    res.status(500).json({
      message: error.message || "Failed to process resume"
    });
  }
};