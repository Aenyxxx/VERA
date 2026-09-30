import logo from "@/assets/images/logo.png";
import bg from "@/assets/images/bg.png";
import side from "@/assets/images/side.png";

import {
  Handshake,
  TrendingUp,
  Users,
} from "lucide-react";

export default function BrandingPanel() {
  return (
    <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:w-[58%]">

          {/* Background */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${bg})`,
            }}
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 z-10 bg-black/35" />

          {/* Decorative side */}
          <img
            src={side}
            alt=""
            className="absolute right-0 top-0 z-20 h-full w-auto object-contain"
          />

          {/* Content */}
          <div className="relative z-30 flex min-h-screen w-full flex-col p-8 lg:p-10">

        {/* Top tagline */}
        <div>
          <p className="max-w-[150px] text-[15px] font-semibold leading-relaxed text-white">
            “People
            <br />
            Powering
            <br />
            Your Success.”
          </p>

          <div className="mt-3 h-[3px] w-7 bg-yellow-400" />
        </div>

        {/* Main branding */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">

          <img
            src={logo}
            alt="Confiable Manpower Solutions"
            className="h-28 w-28 object-contain"
          />

          <h1 className="mt-2 text-2xl font-extrabold tracking-wide text-white">
            CONFIABLE
          </h1>

          <h2 className="text-xl font-bold text-white">
            MANPOWER SOLUTIONS INC.
          </h2>

        </div>

        {/* Feature bar */}
        <div className="w-full max-w-2xl">

          <div className="grid grid-cols-3 divide-x divide-white/20 rounded-lg bg-black/50 px-4 py-4 backdrop-blur-sm">

            {/* Quality Manpower */}
            <div className="flex items-center justify-center gap-2 px-3">

              <Users
                size={26}
                strokeWidth={2}
                className="text-yellow-400"
              />

              <div>
                <p className="text-[10px] font-semibold text-white">
                  Quality
                </p>

                <p className="text-[10px] text-white/70">
                  Manpower
                </p>
              </div>

            </div>

            {/* Reliable Partnerships */}
            <div className="flex items-center justify-center gap-2 px-3">

              <Handshake
                size={26}
                strokeWidth={2}
                className="text-yellow-400"
              />

              <div>
                <p className="text-[10px] font-semibold text-white">
                  Reliable
                </p>

                <p className="text-[10px] text-white/70">
                  Partnerships
                </p>
              </div>

            </div>

            {/* Growing Together */}
            <div className="flex items-center justify-center gap-2 px-3">

              <TrendingUp
                size={26}
                strokeWidth={2}
                className="text-yellow-400"
              />

              <div>
                <p className="text-[10px] font-semibold text-white">
                  Growing
                </p>

                <p className="text-[10px] text-white/70">
                  Together
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Copyright */}
        <p className="mt-4 text-[7px] text-white/70">
          ©2026 Confiable Manpower Solutions Inc. All rights reserved.
        </p>

      </div>
    </section>
  );
}