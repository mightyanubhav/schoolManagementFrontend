import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";

function downloadFile(url, name) {
  fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
    .then(r => r.blob())
    .then((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

export default function Reports() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const students = useQuery({
    queryKey: ["report-students", search, page],
    queryFn: async () => {
      const response = await api.get("/students", { params: { ...(search && { q: search }), page, limit: 25 } });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });

  return (
    <div>
      <PageHeader title="Reports" subtitle="Download PDF and Excel exports" />
      <div className="card space-y-3">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">All students (Excel)</div>
            <div className="text-xs text-gray-500">Admission, name, email, class</div>
          </div>
          <button className="btn-primary w-full justify-center sm:w-auto" onClick={() => downloadFile("/api/reports/students.xlsx", "students.xlsx")}>Download</button>
        </div>
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Fees report (Excel)</div>
            <div className="text-xs text-gray-500">All fee records</div>
          </div>
          <button className="btn-primary w-full justify-center sm:w-auto" onClick={() => downloadFile("/api/reports/fees.xlsx", "fees.xlsx")}>Download</button>
        </div>
        <div className="pt-1">
          <div className="font-medium mb-2">Report card (PDF)</div>
          <div className="text-xs text-gray-500 mb-2">Pick a student to download their report card.</div>
          <Field label="Search student"><input className="input mb-2 max-w-sm" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name, ID, or roll number" /></Field>
          <select
            className="input max-w-sm"
            onChange={(e) => e.target.value && downloadFile(`/api/reports/student/${e.target.value}/pdf`, "report.pdf")}
            defaultValue=""
          >
            <option value="">Select student…</option>
            {students.data?.items?.map(s => <option key={s._id} value={s._id}>{s.user?.name} · {s.admissionNo}</option>)}
          </select>
          <Pagination page={page} total={students.data?.total || 0} limit={25} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}