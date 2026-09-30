import supabase from "./database/supabase.js";
import dotenv from "dotenv";
import pool from "./database/connection.js"

dotenv.config()

const { data, error } = await supabase.auth.signInWithPassword({
    email: "applicant@vera.test",
    password: process.env.TEST_USER_PASSWORD
});

if (error) {
    console.log("Login failed:", error.message);
} else {
    const userId = data.user.id;
    console.log("Login successful!");
    console.log("User ID:", data.user.id);
    const result = await pool.query(
        "SELECT user_account_id, email, role FROM public.user_account WHERE user_account_id = $1",
        [userId]
    );
    
    console.log("Application account: ", result.rows[0]);
}