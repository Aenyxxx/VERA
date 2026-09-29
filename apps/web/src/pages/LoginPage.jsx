import BrandingPanel from "@/components/login/BrandingPanel";
import LoginForm from "@/components/login/LoginForm";
import "@/styles/login.css";

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Help", href: "/help" },
];

export default function LoginPage() {
  return (
    <main className="login-scope grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <BrandingPanel />

      <section className="login-right-bg relative flex min-h-dvh flex-col overflow-hidden">
        <div className="login-gear" aria-hidden="true" />
        <LoginForm />

        <nav
          aria-label="Legal"
          className="relative z-10 flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 pb-6 sm:px-10 lg:justify-end"
        >
          {legalLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-[11px] font-medium text-[var(--cms-blue)] hover:underline"
            >
              {label}
            </a>
          ))}
        </nav>
      </section>
    </main>
  );
}