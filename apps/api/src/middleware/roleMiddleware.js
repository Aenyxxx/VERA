import pool from "../database/connection.js"

export function authorizeRole(requiredRole) {
    return async (req, res, next) => {
        console.log("Authorization middleware reached");
        try {
            const userId = req.user.id;
            console.log("Authorization: checking user", userId);

            const result = await pool.query(
                `SELECT role
                 FROM public.user_account
                 WHERE user_account_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({
                    message: "Application account not found"
                });
            }

            const userRole = result.rows[0].role;
            console.log("Authorization: user role", userRole);

            if (userRole !== requiredRole) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            next();

        } catch (error) {
            console.error("Authorization error:", error);

            res.status(500).json({
                message: "Authorization check failed"
            });
        }
    };
}