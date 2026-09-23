// manage the endpoints

import express from "express";
import { testController } from "../controllers/test.controllers.js";
import { anotherTest } from "../controllers/test.controllers.js";
import { Applicants} from "../controllers/test.controllers.js";

const router = express.Router();

router.get("/applicants", Applicants);

router.get("/test", testController);

router.get("/new", anotherTest);

export default router;
