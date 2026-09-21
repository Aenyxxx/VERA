import { getAllUsers } from "../services/user.service.js";

export const Users = (req, res) => {
    const user = getAllUsers();

    res.json(user);
};