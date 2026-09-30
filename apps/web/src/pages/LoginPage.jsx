import BrandingPanel from "@/components/login/BrandingPanel";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full lg:flex">
      <BrandingPanel />
      <LoginForm />
    </main>
  );
}