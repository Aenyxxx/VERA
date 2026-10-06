import { Handshake, TrendingUp, Users } from "lucide-react";
import { Outlet } from "react-router-dom";

import bg from "@/assets/images/bg.png";
import logo from "@/assets/images/logo.png";
import side from "@/assets/images/side.png";

const VALUES = [
  { icon: Users, title: "Quality", subtitle: "Manpower" },
  { icon: Handshake, title: "Reliable", subtitle: "Partnerships" },
  { icon: TrendingUp, title: "Growing", subtitle: "Together" },
];

function BrandPanel() {
  return (
    <section aria-hidden="true" className="relative hidden overflow-hidden md:flex md:w-[58%]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />
      <div className="absolute inset-0 bg-nav/45" />
      <img src={side} alt="" className="absolute top-0 right-0 h-full w-auto object-contain" />

      <div className="relative flex w-full flex-col p-10">
        <div>
          <p className="max-w-40 font-brand text-section-title font-semibold text-white">
            “People Powering Your Success.”
          </p>
          <div className="mt-3 h-1 w-8 bg-brand-yellow" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center text-white">
          <img src={logo} alt="" className="size-28 object-contain" />
          <p className="mt-2 font-brand text-page-title font-extrabold tracking-wide">CONFIABLE</p>
          <p className="font-brand text-section-title font-bold">MANPOWER SOLUTIONS INC.</p>
        </div>

        <div className="grid max-w-2xl grid-cols-3 divide-x divide-white/20 rounded-md bg-nav/70 px-4 py-4">
          {VALUES.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex items-center justify-center gap-2 px-3">
              <Icon className="size-6 text-brand-yellow" />
              <div className="text-caption">
                <p className="font-semibold text-white">{title}</p>
                <p className="text-white/75">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-caption text-white/75">©2026 Confiable Manpower Solutions Inc. All rights reserved.</p>
      </div>
    </section>
  );
}

/**
 * Login / sign-up layout: 58/42 split with the Confiable brand panel (UI_GUIDELINES §6, DESIGN.md Login).
 * Below 768px the image is replaced by a short brand header and the form comes first.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <BrandPanel />
      <main className="flex w-full flex-col md:w-[42%]">
        <div className="flex items-center gap-3 bg-nav px-4 py-3 md:hidden">
          <img src={logo} alt="" className="size-10 object-contain" />
          <span className="font-brand font-bold text-white">Confiable Manpower Solutions Inc.</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
