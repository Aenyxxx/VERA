import BrandingPanel from "../components/login/BrandingPanel";
import LoginForm from "../components/login/LoginForm";

function LoginPage() {
  return (
    <main className="login-page">
      <BrandingPanel />

      <section className="login-panel">
        <div className="login-card">
          <h1>Welcome to VERA</h1>

          <p>
            Verified Evaluation and Recruitment Assistant!
          </p>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}

export default LoginPage;