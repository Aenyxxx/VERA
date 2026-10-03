import {
    User,
    BriefcaseBusiness,
    FileText,
    LogOut,
    X
} from "lucide-react";
import logo from "@/assets/images/logo.png";

function ApplicantSidebar({ open, onClose, activePage, onNavigate }) {
  return (
    <>
        {open && (
                <button
                type="button"
                aria-label="Close navigation"
                onClick={onClose}
                className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                />
        )}
            <aside
                className={`fixed left-0 top-0 z-50 h-screen w-64 bg-[#102f53] text-white transition-transform duration-300 ${
                open ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0`}
            >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-md p-2 text-slate-300 hover:bg-white/10 lg:hidden"
                aria-label="Close navigation"
            >
                <X size={20} />
            </button>
        
            {/* Logo / Brand */}
            <div className="flex flex-col items-center border-b border-white/10 px-6 pb-6 pt-6 text-center">
                <img
                    src={logo}
                    alt="VERA Logo"
                    className="h-10 w-auto object-contain sm:h-12"
                />

                <div className="mt-3">
                    <h1 className="text-lg font-semibold">VERA</h1>

                    <p className="text-xs tracking-wide text-slate-300">
                    APPLICANT PORTAL
                    </p>
                </div>
            </div>
        
        <div className="mt-8 px-4">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Menu
            </p>

            {/* Navigation */}
            <nav className="mt-10 space-y-2 px-4">
                <button
                    type="button"
                    onClick={() => onNavigate("profile")}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                        activePage === "profile"
                        ? "bg-white/10 text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    >
                    <User size={20} />
                    <span>My Profile</span>
                </button>

                <button
                    type="button"
                    onClick={() => onNavigate("jobs")}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                        activePage === "jobs"
                        ? "bg-white/10 text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    >
                    <BriefcaseBusiness size={20} />
                    <span>Job Vacancies</span>
                </button>

                <button
                    type="button"
                    onClick={() => onNavigate("documents")}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                        activePage === "documents"
                        ? "bg-white/10 text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    >
                    <FileText size={20} />  
                    <span>My Documents</span>
                </button>
            </nav>
        </div>
        {/* Logout */}
        <div className="absolute bottom-6 left-0 w-full px-3">
            <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
            <LogOut size={18} className="text-red-500" />
            <span>Log Out</span>
            </button>
        </div>
        </aside>
    </>
  );
}

export default ApplicantSidebar;