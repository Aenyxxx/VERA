// Manage the structure of the backend

import express from "express";
import cors from "cors";
import Applicant from "./routes/applicant.router.js";
import User from "./routes/user.router.js";
import LogIn from "./routes/login/authRoutes.js"
import applicantRoutes from "./routes/applicant/applicantRoutes.js"

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", Applicant);
app.use("/api", User);
app.use("/api", LogIn);

app.use("/api/applicant", applicantRoutes)


app.get("/", (req, res) => {
    res.json({
        message:"VERA is running!"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status:"ok",
        service:"VERA backend"
    });
});

export default app;