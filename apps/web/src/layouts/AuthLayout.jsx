import { Handshake, TrendingUp, Users } from "lucide-react";
import { Outlet } from "react-router-dom";

import bg from "@/assets/images/bg.png";
import gear from "@/assets/images/gear.png";
import logo from "@/assets/images/logo.png";

const VALUES = [
  { icon: Users, title: "Quality", subtitle: "Manpower" },
  { icon: Handshake, title: "Reliable", subtitle: "Partnerships" },
  { icon: TrendingUp, title: "Growing", subtitle: "Together" },
];

// Diagonal brand accent on the panel's right edge, CSS only (clip-path, % of the accent box).
function DiagonalAccent() {
  return (
    <div className="absolute inset-y-0 right-0 w-[36%]">
      <div className="absolute inset-0 bg-brand-yellow [clip-path:polygon(54%_0,95%_0,70%_30%)]" />
      <div className="absolute inset-0 bg-brand-yellow [clip-path:polygon(62%_44%,21%_100%,4%_100%)]" />
      <div className="absolute inset-0 bg-linear-to-b from-primary to-navy-deep [clip-path:polygon(70%_30%,82%_51%,40%_100%,21%_100%,62%_44%)]" />
      <div className="absolute inset-0 bg-background [clip-path:polygon(95%_0,100%_0,100%_100%,40%_100%,82%_51%,70%_30%)]" />
    </div>
  );
}

function BrandPanel() {
  return (
    <section aria-hidden="true" className="relative hidden overflow-hidden bg-nav lg:flex lg:w-[52%] xl:w-[58%]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />
      <div className="absolute inset-0 bg-linear-to-br from-nav/85 via-navy-deep/55 to-nav/80" />
      <DiagonalAccent />

      <div className="relative flex w-full flex-col py-10 pr-[30%] pl-10">
        <div>
          <p className="max-w-44 font-brand text-section-title font-semibold text-white">
            “People Powering Your Success.”
          </p>
          <div className="mt-3 h-1 w-10 rounded-full bg-brand-yellow" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-white [text-shadow:0_2px_12px_rgb(13_27_42/0.55)]">
          <img src={logo} alt="" className="size-40 object-contain drop-shadow-xl xl:size-52" />
          <p className="mt-4 font-brand text-page-title font-extrabold tracking-wide xl:text-display">CONFIABLE</p>
          <p className="font-brand text-section-title font-extrabold xl:text-page-title">MANPOWER SOLUTIONS INC.</p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/25 rounded-xl bg-nav/70 px-2 py-4 ring-1 ring-white/10 backdrop-blur-sm">
          {VALUES.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex items-center justify-center gap-2.5 px-3">
              <Icon className="size-7 shrink-0 text-brand-yellow" />
              <div className="text-body leading-tight">
                <p className="font-semibold text-white">{title}</p>
                <p className="text-white/80">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-caption text-white/80">©2026 Confiable Manpower Solutions Inc. All rights reserved.</p>
      </div>
    </section>
  );
}

/**
 * Login / sign-up layout: brand panel + form (UI_REDESIGN §4, design 01).
 * Below 1024px the panel collapses into a short navy brand header above the form.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <BrandPanel />
      <main className="relative flex w-full min-w-0 flex-col overflow-hidden lg:w-[48%] xl:w-[42%]">
        <div className="relative flex items-center gap-3 overflow-hidden bg-linear-to-r from-nav to-navy-deep py-3 pr-20 pl-4 lg:hidden">
          <img src={logo} alt="" className="size-10 object-contain" />
          <span className="font-brand font-bold text-white">Confiable Manpower Solutions Inc.</span>
          <span aria-hidden="true" className="absolute inset-y-0 right-10 w-3 -skew-x-[20deg] bg-brand-yellow" />
          <span aria-hidden="true" className="absolute inset-y-0 right-4 w-3 -skew-x-[20deg] bg-primary" />
        </div>
        <img
          src={gear}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -right-28 hidden size-80 -translate-y-1/2 opacity-[0.08] lg:block"
        />
        <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
