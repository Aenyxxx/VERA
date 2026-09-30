import supabase from "../database/supabase.js";

export async function authenticate(req, res, next) {
    {/*Header*/}
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Authorization header is required"
        });
    }

    {/*Token Handler*/}
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            message: "Access token is required"
        });
    }

    {/*Send Token to supa */}
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
    req.user = data.user;

    next();
}