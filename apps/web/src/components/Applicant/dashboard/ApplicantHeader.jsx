import { 
    Bell,
    CalendarDays,
    ChevronDown,
    Menu,
} from "lucide-react";

function ApplicantHeader({ onMenuClick, hideWelcome = false, displayName}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        
        {/* Left Side */}
        <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
                type="button"
                onClick={onMenuClick}
                className="rounded-md p-2 text-[#102f53] hover:bg-slate-100 lg:hidden"
            >
                <Menu size={22} />
            </button>
            {/* Welcome */}
            {!hideWelcome && (
              <div>
                <p className="text-sm text-slate-600">
                  Good day,
                </p>

                <h1 className="text-xl font-bold text-[#102f53] sm:text-2xl">
                  {displayName} 👋
                </h1>

                <p className="hidden text-sm text-slate-500 sm:block">
                  Stay updated with your application journey. Opportunities are
                  closer than you think.
                </p>
              </div>
            )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 sm:gap-5">
          
          {/* Notification */}
          <button
            type="button"
            className="relative rounded-full p-2 text-blue-700 hover:bg-slate-100"
          >
            <Bell size={20} />

            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              3
            </span>
          </button>

          {/* Date */}
          <div className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
            <CalendarDays size={19} className="text-blue-600" />
            <span>September 19, 2026</span>
          </div>

          {/* User */}
          <button
            type="button"
            className="flex items-center gap-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              {displayName.slice(0,2).toUpperCase()}
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-[#102f53]">
                {displayName}
              </p>

              <p className="text-xs text-slate-500">
                Applicant
              </p>
            </div>

            <ChevronDown
              size={17}
              className="text-blue-600"
            />
          </button>
        </div>
      </div>
    </header>
  );
}

export default ApplicantHeader;