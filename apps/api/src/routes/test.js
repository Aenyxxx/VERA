import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRole } from "../middleware/roleMiddleware.js";
import { getApplications } from "../controllers/applications/applicationController.js";

const router = express.Router();

router.get("/protected", authenticate, (req, res) => {
    res.json({
        message: "You are authenticated",
        user: req.user
    });
});

router.get("/admin-only", authenticate, authorizeRole("admin"), (req, res) => {
    res.json({
        message:"You are authenticated and authorized as admin"
    });
});

router.get("/applicant-only", authenticate, authorizeRole("applicant"), (req, res) => {
    res.json({
        message:"You are authenticated and authorize as applicant"
    });
});

router.get(
    "/applications",
    authenticate,
    authorizeRole("applicant"),
    getApplications
);


export default router;