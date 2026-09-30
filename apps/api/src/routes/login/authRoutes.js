import express from "express";
import { login } from "../../controllers/login/authController.js";

const router = express.Router();

router.post("/auth", login);

export default router;