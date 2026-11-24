import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { schoolBrand } from "../branding";
import SchoolLogo from "./SchoolLogo";

const navigation = [
  { to: "/", label: "Dashboard", end: true, roles: ["admin", "teacher", "student", "parent"] },
  { to: "/students", label: "Students", roles: ["admin", "teacher"] },
  { to: "/teachers", label: "Teachers", roles: ["admin"] },
  { to: "/classes", label: "Classes", roles: ["admin", "teacher"] },
  { to: "/subjects", label: "Subjects", roles: ["admin", "teacher"] },
  { to: "/attendance", label: "Attendance", roles: ["admin", "teacher", "student", "parent"] },
  { to: "/exams", label: "Exams", roles: ["admin", "teacher", "student", "parent"] },
  { to: "/fees", label: "Fees", roles: ["admin", "student", "parent"] },
  { to: "/salary", label: "Salary", roles: ["admin"] },
  { to: "/announcements", label: "Announcements", roles: ["admin", "teacher", "student", "parent"] },
  { to: "/timetable", label: "Timetable", roles: ["admin", "teacher", "student", "parent"] },
  { to: "/reports", label: "Reports", roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => item.roles.includes(user?.role));
  const initials = user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U";

  function signOut() {
    logout();
    nav2("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:translate-x-0 md:shadow-none ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <SchoolLogo className="h-12 w-12" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight tracking-tight text-slate-900">{schoolBrand.name}</div>
            <div className="mt-1 truncate text-[11px] text-slate-500">{schoolBrand.address}</div>
          </div>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{user?.name}</div>
              <div className="mt-0.5 text-xs capitalize text-slate-500">{user?.role} account</div>
            </div>
          </div>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</div>
          {visibleNavigation.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" aria-hidden="true" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <Link to="/change-password" className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs" aria-hidden="true">•••</span>
            Change password
          </Link>
          <button type="button" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700" onClick={signOut}>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs" aria-hidden="true">↗</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open navigation menu" aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100" onClick={() => setMenuOpen(true)}>
              <span className="text-xl" aria-hidden="true">☰</span>
            </button>
            <SchoolLogo className="h-9 w-9" />
            <div className="max-w-[13rem] truncate text-sm font-bold tracking-tight text-slate-900">{schoolBrand.name}</div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{initials}</div>
        </header>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
          <footer className="mt-10 border-t border-slate-200/80 pt-4 text-center text-xs text-slate-400">
            <span className="font-medium text-slate-500">{schoolBrand.name}</span>
            <span className="mx-2">·</span>
            {schoolBrand.address}
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="hidden sm:inline">{schoolBrand.motto}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}