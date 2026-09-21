import express from "express";
import cors from "cors";
import testRoute from "./routes/test.js";
import Applicant from "./routes/applicant.router.js";
import User from "./routes/user.router.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", testRoute);
app.use("/api", Applicant);
app.use("/api", User);


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