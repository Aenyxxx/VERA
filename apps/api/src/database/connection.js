import dotenv from "dotenv";
import pg, { Result } from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool ({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.query("SELECT NOW()")
    .then(result => {
        console.log("Database connected:", result.rows[0]);
    })
    .catch(error => {
        console.log("Database connection failed: ", error);
    });
    
export default pool;