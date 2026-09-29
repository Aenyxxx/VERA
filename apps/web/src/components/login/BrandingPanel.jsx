import {
  Handshake,
  TrendingUp,
  Users,
} from "lucide-react";

import logo from "@/assets/images/logo.png";
import backgroundImage from "@/assets/images/bg.png";
import sideImage from "@/assets/images/side.png";


function BrandingPanel() {
  return (
    <section
      className="
        branding-panel
        relative
        hidden
        min-h-screen
        lg:flex
        lg:flex-col
        lg:justify-between
        px-8
        py-7
        xl:px-10
      "
    >

      {/* =================================================
          BACKGROUND IMAGE
          ================================================= */}

      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="
          absolute
          inset-0
          z-[-2]
          h-full
          w-full
          object-cover
        "
      />


      {/* =================================================
          DARK OVERLAY
          ================================================= */}

      <div
        className="branding-panel-overlay"
        aria-hidden="true"
      />


      {/* =================================================
          GEOMETRIC SIDE IMAGE
          ================================================= */}

      <img
        src={sideImage}
        alt=""
        aria-hidden="true"
        className="branding-side-image"
      />


      {/* =================================================
          TOP QUOTE
          ================================================= */}

      <div
        className="
          relative
          z-10
          max-w-[220px]
        "
      >
        <p
          className="
            text-sm
            font-medium
            leading-tight
            text-white
            drop-shadow-md
            xl:text-base
          "
        >
          “People
          <br />
          Powering
          <br />
          Your Success.”
        </p>


        {/* Yellow accent line */}

        <div
          className="
            mt-3
            h-1
            w-8
            rounded-full
            bg-[#ffd900]
          "
        />
      </div>


      {/* =================================================
          CENTER CONTENT
          ================================================= */}

      <div
        className="
          relative
          z-10
          flex
          flex-1
          flex-col
          items-center
          justify-center
          pr-[8%]
          text-center
        "
      >

        {/* Company Logo */}

        <img
          src={logo}
          alt="Confiable Manpower Solutions Inc."
          className="
            mb-4
            w-36
            object-contain
            drop-shadow-lg
            sm:w-40
            xl:w-48
          "
        />


        {/* Company Name */}

        <h1
          className="
            max-w-[420px]
            text-2xl
            font-extrabold
            leading-tight
            tracking-tight
            text-white
            drop-shadow-lg
            sm:text-3xl
            xl:text-4xl
          "
        >
          CONFIABLE
          <br />
          MANPOWER SOLUTIONS INC.
        </h1>

      </div>


      {/* =================================================
          FEATURE PILLARS
          ================================================= */}

      <div
        className="
          branding-features
          relative
          z-10
          mb-5
          mr-[8%]
          flex
          items-center
          justify-center
          rounded-sm
          px-3
          py-4
          sm:px-5
        "
      >

        {/* -------------------------------------------------
            QUALITY MANPOWER
            ------------------------------------------------- */}

        <div
          className="
            flex
            flex-1
            items-center
            justify-center
            gap-2
            text-white
          "
        >
          <Users
            className="
              h-7
              w-7
              shrink-0
              text-[#ffd900]
              xl:h-8
              xl:w-8
            "
            strokeWidth={2.2}
          />

          <span
            className="
              text-[10px]
              font-medium
              leading-tight
              sm:text-xs
              xl:text-sm
            "
          >
            Quality
            <br />
            Manpower
          </span>
        </div>


        {/* Divider */}

        <div
          className="
            h-9
            w-px
            bg-white/40
          "
        />


        {/* -------------------------------------------------
            RELIABLE PARTNERSHIPS
            ------------------------------------------------- */}

        <div
          className="
            flex
            flex-1
            items-center
            justify-center
            gap-2
            text-white
          "
        >
          <Handshake
            className="
              h-7
              w-7
              shrink-0
              text-[#ffd900]
              xl:h-8
              xl:w-8
            "
            strokeWidth={2.2}
          />

          <span
            className="
              text-[10px]
              font-medium
              leading-tight
              sm:text-xs
              xl:text-sm
            "
          >
            Reliable
            <br />
            Partnerships
          </span>
        </div>


        {/* Divider */}

        <div
          className="
            h-9
            w-px
            bg-white/40
          "
        />


        {/* -------------------------------------------------
            GROWING TOGETHER
            ------------------------------------------------- */}

        <div
          className="
            flex
            flex-1
            items-center
            justify-center
            gap-2
            text-white
          "
        >
          <TrendingUp
            className="
              h-7
              w-7
              shrink-0
              text-[#ffd900]
              xl:h-8
              xl:w-8
            "
            strokeWidth={2.2}
          />

          <span
            className="
              text-[10px]
              font-medium
              leading-tight
              sm:text-xs
              xl:text-sm
            "
          >
            Growing
            <br />
            Together
          </span>
        </div>

      </div>


      {/* =================================================
          COPYRIGHT
          ================================================= */}

      <div
        className="
          relative
          z-10
          pr-[8%]
          text-[8px]
          text-white/90
          sm:text-[9px]
        "
      >
        ©2026 Confiable Manpower Solutions Inc.
        All rights reserved.
      </div>

    </section>
  );
}


export default BrandingPanel;
