import express from "express";
import { testController } from "../controllers/test.controllers.js";

const router = express.Router();

router.get("/test", testController);

export default router;

