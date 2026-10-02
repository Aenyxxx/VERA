import supabase from "../database/supabase.js";

export async function authenticate(req, res, next) {
    console.log("Authentication middleware reached");
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

    console.log("Checking token with Supabase...");

    {/*Send Token to supa */}
    const { data, error } = await supabase.auth.getUser(token);
    console.log("Supabase getUser finished");
    console.log("User:", data.user);
    console.log("Error:", error);
    if (error || !data.user) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
    req.user = data.user;

    console.log("User attached to request");
    console.log("Calling next()");

    next();
}