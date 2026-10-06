
import pool from "../../database/connection.js";

//Pulling the applicant profile in Supabase
export const getApplicantProfile = async (userAccountId) => {
  const result = await pool.query(
    `
      SELECT
        a.applicant_id,
        a.user_account_id,
        a.first_name,
        a.middle_name,
        a.last_name,
        a.suffix,
        a.contact_number,
        a.birthdate,
        a.gender,
        a.height,
        a.address,
        a.province,
        a.city,
        a.registration_date,
        a.status,
        u.email
      FROM public.applicant a
      JOIN public.user_account u
        ON a.user_account_id = u.user_account_id
      WHERE a.user_account_id = $1
    `,
    [userAccountId]
  );

  return result.rows[0];
};

export const checkApplicantProfile = async (userAccountId) => {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.applicant
        WHERE user_account_id = $1
      ) AS "profileExists"
    `,
    [userAccountId]
  );

  return result.rows[0].profileExists;
};