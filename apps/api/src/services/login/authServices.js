import supabase from "../../database/supabase.js";
import pool from "../../database/connection.js";

export async function loginUser(email, password) {
    const {data, error} = await supabase.auth.signInWithPassword({
        email,password
    });

    if (error) {
        throw new Error(error,message);
    }

    const userId = data.user.id;
    const result = await pool.query(
        "SELECT user_account_id, email, role from public.user_account where user_account_id = $1",
        [userId]
    );

    return {
        user: data.user,
        account: result.rows[0]
    };
    
}