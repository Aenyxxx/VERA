import { loginUser } from "../../services/login/authServices.js";

export async function login(req, res) {
    try {
        const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    message: "Email and password are required"
                });
            }

        const result = await loginUser(email, password);

        res.json(result);
    }catch (error) {

        console.error("Login error: ", error);

        res.status(401).json({
            message:error.message
        });
    }
    
}