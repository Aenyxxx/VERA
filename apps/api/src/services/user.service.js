const users = [
  {
    username: "admin",
    password: "admin123",
    role: "admin"
  },
  {
    username: "john",
    password: "john123",
    role: "user"
  },
  {
    username: "jane",
    password: "jane123",
    role: "user"
  }
];

export const getAllUsers = () => {
    return users;
};