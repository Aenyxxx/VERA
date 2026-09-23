function LoginForm() {
  return (
    <form className="login-form">
      <input
        type="email"
        placeholder="Email Address"
      />

      <input
        type="password"
        placeholder="Password"
      />

      <button type="submit">
        Log In
      </button>
    </form>
  );
}

export default LoginForm;