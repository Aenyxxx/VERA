import supabase from "../../database/supabase.js";
import pool from "../../database/connection.js";

export async function loginUser(email, password) {
    const {data, error} = await supabase.auth.signInWithPassword({
        email,password
    });

    if (error) {
        throw new Error(error.message);
    }

    const userId = data.user.id;
    const result = await pool.query(
        "SELECT user_account_id, email, role from public.user_account where user_account_id = $1",
        [userId]
    );
    
    if (result.rows.length === 0) {
        throw new Error("User account not found");
    }

    return {
        user: {
            id: data.user.id,
            email: data.user.email
        },
        account: {
            email: result.rows[0].email,
            role: result.rows[0].role
        },
        session: {
            access_token: data.session.access_token
        }
    };
    
}