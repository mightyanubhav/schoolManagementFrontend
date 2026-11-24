import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import Pagination from "../components/Pagination";

const statuses = [
  ["present", "Present", "text-green-700"],
  ["absent", "Absent", "text-red-700"],
  ["late", "Late", "text-amber-700"],
  ["leave", "Leave", "text-blue-700"],
];

function dateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadCsv(records, type) {
  const header = ["Date", type === "teachers" ? "Teacher" : "Student", type === "teachers" ? "Employee ID" : "Roll / Student ID", "Class", "Status"];
  const rows = records.map((record) => [
    new Date(record.date).toLocaleDateString("en-IN"),
    record.name,
    record.identifier,
    record.className,
    record.status,
  ]);
  const cell = (value) => {
    const safeValue = String(value ?? "").replace(/^([=+\-@])/, "'$1").replaceAll('"', '""');
    return `"${safeValue}"`;
  };
  const content = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${type}-${dateInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceReport() {
  const { user } = useAuth();
  const today = new Date();
  const [type, setType] = useState("students");
  const [from, setFrom] = useState(dateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateInput(today));
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);
  const [peoplePage, setPeoplePage] = useState(1);

  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data) });
  useEffect(() => {
    setRecordsPage(1);
    setPeoplePage(1);
  }, [type, from, to, classId, status, search]);

  const report = useQuery({
    queryKey: ["attendance-report", type, from, to, classId, status, search, recordsPage, peoplePage],
    queryFn: async () => {
      const response = await api.get("/attendance/report", { params: {
      type,
      ...(from && { from }),
      ...(to && { to }),
      ...(type === "students" && classId && { class: classId }),
      ...(status && { status }),
      ...(search && { q: search }),
        page: recordsPage,
        limit: 25,
        peoplePage,
        peopleLimit: 25,
      } });
      return {
        ...response.data,
        recordsTotal: Number(response.headers["x-total-count"] || 0),
        peopleTotal: Number(response.headers["x-people-count"] || 0),
      };
    },
  });

  const summary = report.data?.summary || { totalRecords: 0, present: 0, absent: 0, late: 0, leave: 0, peopleCount: 0 };

  return (
    <div className="space-y-4">
      {user?.role === "admin" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={type === "students" ? "btn-primary" : "btn-ghost"} onClick={() => setType("students")}>Student report</button>
          <button type="button" className={type === "teachers" ? "btn-primary" : "btn-ghost"} onClick={() => { setType("teachers"); setClassId(""); }}>Teacher report</button>
        </div>
      )}

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="From"><input className="input w-full" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="To"><input className="input w-full" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></Field>
        {type === "students" && <Field label="Class"><select className="input w-full" value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">All classes</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>}
        <Field label="Status"><select className="input w-full" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Search"><input className="input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={type === "students" ? "Name, roll, ID, or class" : "Name or employee ID"} /></Field>
      </div>

      {report.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{report.error.response?.data?.error || "Could not load attendance report"}</div>}
      {report.isLoading && <div className="card text-sm text-slate-500">Loading attendance report…</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="People" value={summary.peopleCount} />
        <Metric label="Records" value={summary.totalRecords} />
        {statuses.map(([value, label, color]) => <Metric key={value} label={label} value={summary[value]} color={color} />)}
      </div>

      <section className="card p-0 overflow-x-auto">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold">Attendance by person</h2><p className="text-xs text-slate-500">Attendance rate counts present and late records.</p></div>
          <button type="button" className="btn-ghost justify-center" disabled={!report.data?.records?.length} onClick={() => downloadCsv(report.data.records, type)}>Download current page CSV</button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="th">{type === "students" ? "Student" : "Teacher"}</th><th className="th">{type === "students" ? "Roll / Student ID" : "Employee ID"}</th>{type === "students" && <th className="th">Class</th>}<th className="th">Days recorded</th><th className="th">Present</th><th className="th">Absent</th><th className="th">Late</th><th className="th">Leave</th><th className="th">Attendance rate</th></tr></thead>
          <tbody>{report.data?.people?.map((person) => <tr key={person.personId} className="border-t border-gray-100"><td className="td">{person.name}</td><td className="td">{person.identifier || "—"}</td>{type === "students" && <td className="td">{person.className}</td>}<td className="td">{person.daysRecorded}</td><td className="td text-green-700">{person.present}</td><td className="td text-red-700">{person.absent}</td><td className="td text-amber-700">{person.late}</td><td className="td text-blue-700">{person.leave}</td><td className="td font-medium">{person.attendanceRate}%</td></tr>)}
            {!report.data?.people?.length && !report.isLoading && <tr><td className="td text-center text-slate-500" colSpan={type === "students" ? 9 : 8}>No attendance records match these filters.</td></tr>}
          </tbody>
        </table>
        <Pagination page={peoplePage} total={report.data?.peopleTotal || 0} limit={25} onChange={setPeoplePage} />
      </section>

      <section className="card p-0 overflow-x-auto">
        <div className="border-b border-slate-100 p-4"><h2 className="font-semibold">Daily attendance records</h2></div>
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Name</th><th className="th">ID / Roll</th>{type === "students" && <th className="th">Class</th>}<th className="th">Status</th></tr></thead>
          <tbody>{report.data?.records?.map((record) => <tr key={record._id} className="border-t border-gray-100"><td className="td">{new Date(record.date).toLocaleDateString()}</td><td className="td">{record.name}</td><td className="td">{record.identifier || "—"}</td>{type === "students" && <td className="td">{record.className}</td>}<td className="td capitalize">{record.status}</td></tr>)}
            {!report.data?.records?.length && !report.isLoading && <tr><td className="td text-center text-slate-500" colSpan={type === "students" ? 5 : 4}>No attendance records match these filters.</td></tr>}
          </tbody>
        </table>
        <Pagination page={recordsPage} total={report.data?.recordsTotal || 0} limit={25} onChange={setRecordsPage} />
      </section>
    </div>
  );
}

function Metric({ label, value, color = "text-slate-900" }) {
  return <div className="card"><span className="block text-xs text-slate-500">{label}</span><strong className={`mt-1 block text-2xl ${color}`}>{value}</strong></div>;
}
