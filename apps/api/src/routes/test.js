import express from "express";
import { authenticate } from "../middleware/middleware.js";

const router = express.Router();

router.get("/protected", authenticate, (req, res) => {
    res.json({
        message: "You are authenticated",
        user: req.user
    });
});

export default router;