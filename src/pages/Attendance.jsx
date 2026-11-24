import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import AttendanceReport from "./AttendanceReport";
import Pagination from "../components/Pagination";

function localDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MarkAttendance() {
  const { user } = useAuth();
  const canMark = ["admin", "teacher"].includes(user?.role);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => localDateInput(new Date()));
  const [rows, setRows] = useState([]);
  const [attendanceType, setAttendanceType] = useState("students");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teacherRows, setTeacherRows] = useState([]);

  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data) });

  const students = useQuery({
    queryKey: ["attendance-class", classId, date],
    queryFn: () => api.get(`/attendance/class-today/${classId}`, { params: { date } }).then(r => r.data),
    enabled: !!classId && attendanceType === "students",
  });

  const teachers = useQuery({
    queryKey: ["attendance-teachers", date],
    queryFn: () => api.get("/attendance/teachers", { params: { date } }).then(r => r.data),
    enabled: attendanceType === "teachers" && user?.role === "admin",
  });

  useEffect(() => { setRows(students.data || []); }, [students.data]);
  useEffect(() => { setTeacherRows(teachers.data || []); }, [teachers.data]);

  const save = useMutation({
    mutationFn: () =>
      api.post("/attendance/bulk", {
        class: classId,
        date,
        entries: rows.map(r => ({ student: r._id, status: r.status })),
      }),
  });

  const saveTeachers = useMutation({
    mutationFn: () =>
      api.post("/attendance/teachers/bulk", {
        date,
        entries: teacherRows.map(r => ({ teacher: r._id, status: r.status })),
      }),
  });

  const visibleStudentRows = rows.filter((r) => {
    const matchesSearch = `${r.name || ""} ${r.rollNo || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const visibleTeacherRows = teacherRows.filter((r) => {
    const matchesSearch = `${r.name || ""} ${r.employeeId || ""} ${r.email || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader title="Attendance" subtitle={canMark ? "Mark daily attendance per class" : "Review daily attendance by class"} />
      {user?.role === "admin" && (
        <div className="mb-4 flex gap-2">
          <button type="button" className={attendanceType === "students" ? "btn-primary" : "btn-ghost"} onClick={() => { setAttendanceType("students"); setSearch(""); setStatusFilter("all"); }}>Student attendance</button>
          <button type="button" className={attendanceType === "teachers" ? "btn-primary" : "btn-ghost"} onClick={() => { setAttendanceType("teachers"); setSearch(""); setStatusFilter("all"); }}>Teacher attendance</button>
        </div>
      )}
      <div className="card mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {attendanceType === "students" && <div>
          <label className="label">Class</label>
          <select className="input min-w-[200px]" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select class</option>
            {classes.data?.map(c => <option key={c._id} value={c._id}>{c.name} · Section {c.section || "A"}</option>)}
          </select>
        </div>}
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Search</label>
          <input className="input min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={attendanceType === "students" ? "Name or roll no." : "Name, email or employee ID"} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="leave">Leave</option>
          </select>
        </div>
        {canMark && attendanceType === "students" && <button className="btn-primary justify-center" disabled={!classId || !rows.length || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save attendance"}
        </button>}
        {canMark && attendanceType === "teachers" && <button className="btn-primary justify-center" disabled={!teacherRows.length || saveTeachers.isPending} onClick={() => saveTeachers.mutate()}>
          {saveTeachers.isPending ? "Saving…" : "Save attendance"}
        </button>}
        {(save.isSuccess || saveTeachers.isSuccess) && <span className="text-sm text-green-600">Saved</span>}
      </div>

      {classes.isError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{classes.error.response?.data?.error || "Could not load classes"}</div>}
      {attendanceType === "students" && !classId && <p className="mb-4 text-sm text-slate-500">Select a class to load its student roster.</p>}
      {attendanceType === "students" && students.isLoading && <div className="card text-sm text-slate-500">Loading student attendance…</div>}
      {attendanceType === "students" && students.isError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{students.error.response?.data?.error || "Could not load student attendance"}</div>}
      {attendanceType === "students" && students.isSuccess && classId && rows.length === 0 && <div className="card text-sm text-slate-500">No students are enrolled in this class.</div>}
      {attendanceType === "teachers" && teachers.isLoading && <div className="card text-sm text-slate-500">Loading teacher attendance…</div>}
      {attendanceType === "teachers" && teachers.isError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{teachers.error.response?.data?.error || "Could not load teacher attendance"}</div>}
      {(save.isError || saveTeachers.isError) && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{save.error?.response?.data?.error || saveTeachers.error?.response?.data?.error || "Could not save attendance"}</div>}

      {attendanceType === "students" && rows.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="th">Roll</th><th className="th">Name</th><th className="th">Status</th>
            </tr></thead>
            <tbody>
              {visibleStudentRows.map((r) => (
                <tr key={r._id} className="border-t border-gray-100">
                  <td className="td">{r.rollNo}</td>
                  <td className="td">{r.name}</td>
                  <td className="td">
                    {canMark ? (
                    <select
                      className="input py-1"
                      value={r.status}
                      onChange={(e) => {
                        setRows((current) => current.map((row) => row._id === r._id ? { ...row, status: e.target.value } : row));
                      }}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="leave">Leave</option>
                    </select>
                    ) : <span className="capitalize">{r.status || "—"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {attendanceType === "teachers" && teacherRows.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="th">Employee</th><th className="th">Name</th><th className="th">Email</th><th className="th">Status</th>
            </tr></thead>
            <tbody>
              {visibleTeacherRows.map((r) => (
                <tr key={r._id} className="border-t border-gray-100">
                  <td className="td font-mono text-xs">{r.employeeId}</td>
                  <td className="td">{r.name}</td>
                  <td className="td">{r.email}</td>
                  <td className="td">
                    {user?.role === "admin" ? (
                      <select
                        className="input py-1"
                        value={r.status}
                        onChange={(e) => setTeacherRows((current) => current.map((row) => row._id === r._id ? { ...row, status: e.target.value } : row))}
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="leave">Leave</option>
                      </select>
                    ) : <span className="capitalize">{r.status || "—"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentAttendance() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const attendance = useQuery({
    queryKey: ["my-attendance", from, to, page],
    queryFn: async () => {
      const response = await api.get("/attendance/me", { params: {
      ...(from && { from }),
      ...(to && { to }),
        page,
        limit: 25,
      } });
      return {
        ...response.data,
        pageTotal: Number(response.headers["x-total-count"] || 0),
      };
    },
  });
  const summary = attendance.data?.summary || { total: 0, present: 0, absent: 0, late: 0, leave: 0, attendanceRate: 0 };
  const statuses = {
    present: "bg-green-100 text-green-700",
    absent: "bg-red-100 text-red-700",
    late: "bg-amber-100 text-amber-700",
    leave: "bg-blue-100 text-blue-700",
  };

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle={attendance.data ? `${attendance.data.student.class?.name || "Student"} · Section ${attendance.data.student.class?.section || "A"} · Roll ${attendance.data.student.rollNo || "—"}` : "View your attendance record"}
      />
      <div className="card mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">From</label><input className="input w-full" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div>
        <div><label className="label">To</label><input className="input w-full" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div>
      </div>
      {attendance.isError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{attendance.error.response?.data?.error || "Could not load your attendance"}</div>}
      {attendance.isLoading && <div className="card text-sm text-slate-500">Loading attendance…</div>}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Days recorded", summary.total, "text-slate-900"],
          ["Present", summary.present, "text-green-700"],
          ["Absent", summary.absent, "text-red-700"],
          ["Late", summary.late, "text-amber-700"],
          ["Leave", summary.leave, "text-blue-700"],
          ["Attendance rate", `${summary.attendanceRate}%`, "text-slate-900"],
        ].map(([label, value, color]) => <div key={label} className="card"><span className="block text-xs text-slate-500">{label}</span><strong className={`mt-1 block text-2xl ${color}`}>{value}</strong></div>)}
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Class</th><th className="th">Status</th></tr></thead>
          <tbody>{attendance.data?.records.map((record) => <tr key={record._id} className="border-t border-gray-100"><td className="td">{new Date(record.date).toLocaleDateString()}</td><td className="td">{attendance.data.student.class?.name || "—"} · {attendance.data.student.class?.section || "A"}</td><td className="td"><span className={`rounded px-2 py-0.5 text-xs capitalize ${statuses[record.status] || "bg-slate-100 text-slate-700"}`}>{record.status}</span></td></tr>)}
            {!attendance.data?.records.length && !attendance.isLoading && <tr><td className="td text-center text-slate-500" colSpan="3">No attendance records found for this period.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={attendance.data?.pageTotal || 0} limit={25} onChange={setPage} />
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const canViewReports = ["admin", "teacher"].includes(user?.role);
  const [view, setView] = useState("mark");

  if (user?.role === "student") return <StudentAttendance />;

  return (
    <div>
      {canViewReports && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" className={view === "mark" ? "btn-primary" : "btn-ghost"} onClick={() => setView("mark")}>Mark attendance</button>
          <button type="button" className={view === "report" ? "btn-primary" : "btn-ghost"} onClick={() => setView("report")}>Attendance report</button>
        </div>
      )}
      {view === "report" && canViewReports ? <AttendanceReport /> : <MarkAttendance />}
    </div>
  );
}