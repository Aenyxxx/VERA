import { loginUser } from "../../services/login/authServices.js";

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        const result = await loginUser(email, password);

        res.json(result);
    }catch (error) {
        res.status(401).json({
            message:error.message
        });
    }
    
}