import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";

function Stat({ label, value, hint }) {
  return (
    <div className="card min-w-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{value ?? "—"}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const userId = user?._id || user?.id;
  const students = useQuery({
    queryKey: ["dashboard-students", userId],
    queryFn: async () => {
      const response = await api.get("/students", { params: { limit: 1 } });
      return { total: Number(response.headers["x-total-count"] || 0) };
    },
    enabled: isAdmin || isTeacher,
  });
  const teachers = useQuery({
    queryKey: ["dashboard-teachers", userId],
    queryFn: async () => {
      const response = await api.get("/teachers", { params: { limit: 1 } });
      return { total: Number(response.headers["x-total-count"] || 0) };
    },
    enabled: isAdmin,
  });
  const classes = useQuery({ queryKey: ["dashboard-classes", userId], queryFn: () => api.get("/classes").then(r => r.data), enabled: isAdmin || isTeacher });
  const fees = useQuery({
    queryKey: ["dashboard-fees", userId],
    queryFn: async () => {
      const response = await api.get("/fees", { params: { limit: 1 } });
      return { pending: Number(response.headers["x-total-pending"] || 0) };
    },
    enabled: isAdmin,
  });
  const anns = useQuery({
    queryKey: ["dashboard-announcements", userId],
    queryFn: async () => {
      const response = await api.get("/announcements", { params: { limit: 5 } });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });

  const pendingFees = fees.data?.pending;
  const firstName = user?.name?.split(" ")[0] || "there";
  const roleSubtitle = {
    admin: "Your school at a glance. Here's what's happening across your community.",
    teacher: "Your teaching workspace at a glance. Stay up to date with your school community.",
    student: "Your school at a glance. Catch up on the latest updates and activities.",
    parent: "Your school community at a glance. Catch up on the latest updates and activities.",
  };
  const shortcuts = isTeacher
    ? [
        { to: "/attendance", title: "Take attendance", detail: "Record attendance for a class" },
        { to: "/announcements", title: "Announcements", detail: "Share an update with your school" },
        { to: "/timetable", title: "Timetable", detail: "Check the weekly class schedule" },
      ]
    : [
        { to: "/timetable", title: "Class timetable", detail: "See the weekly schedule" },
        { to: "/attendance", title: "Attendance", detail: "Review attendance information" },
        { to: "/exams", title: "Exams", detail: "Check exam information" },
        { to: "/fees", title: "Fees", detail: "Review fee information" },
      ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={roleSubtitle[user?.role] || "Your school at a glance."}
        actions={isAdmin && <Link className="btn-primary justify-center" to="/reports">Open reports</Link>}
      />
      {(isAdmin || isTeacher) && <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 ${isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
        <Stat label="Students" value={students.data?.total} />
        {isAdmin && <Stat label="Teachers" value={teachers.data?.total} />}
        <Stat label="Classes" value={classes.data?.length} />
        {isAdmin && <Stat label="Pending Fees" value={pendingFees != null ? `₹${pendingFees.toLocaleString("en-IN")}` : "—"} />}
      </div>}

      {!isAdmin && <section className="mb-5 mt-5 sm:mb-6 sm:mt-6">
        <div className="mb-3 text-sm font-semibold text-slate-900">Quick access</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.to} to={shortcut.to} className="group card flex min-h-28 items-start justify-between gap-3 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{shortcut.title}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">{shortcut.detail}</span>
              </span>
              <span className="text-lg text-brand-600 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>}

      <div className={`card ${isAdmin ? "mt-5 sm:mt-6" : "mt-5"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900">Latest announcements</div>
            <p className="mt-1 text-xs text-slate-500">Updates from your school community</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{anns.data?.total ?? 0} updates</span>
        </div>
        <ul className="space-y-3">
          {anns.data?.items?.map(a => (
            <li key={a._id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-900">{a.title}</div>
                {a.pinned && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Pinned</span>}
              </div>
              <div className="mt-1 break-words text-sm leading-6 text-slate-600">{a.body}</div>
            </li>
          ))}
          {!anns.data?.items?.length && <li className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Nothing to announce just yet.</li>}
        </ul>
      </div>
    </div>
  );
}