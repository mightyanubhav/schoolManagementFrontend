import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

function downloadFile(url, name) {
  fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
    .then((response) => {
      if (!response.ok) throw new Error("Download failed");
      return response.blob();
    })
    .then((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    })
    .catch(() => window.alert("Could not download this report. Please try again."));
}

export default function Reports() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedSearch(search, () => setPage(1));
  const [studentId, setStudentId] = useState("");
  const [examGroupId, setExamGroupId] = useState("");
  const students = useQuery({
    queryKey: ["report-students", debouncedSearch, page],
    queryFn: async ({ signal }) => {
      const response = await api.get("/students", { params: { ...(debouncedSearch && { q: debouncedSearch }), page, limit: 25 }, signal });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });
  const resultGroups = useQuery({
    queryKey: ["report-card-groups"],
    queryFn: () => api.get("/exams/results/consolidated").then((response) => response.data),
  });
  const selectedStudent = students.data?.items?.find((student) => student._id === studentId);
  const studentGroups = resultGroups.data?.filter((group) => !studentId || group.class?._id === selectedStudent?.class?._id) || [];
  const selectedGroup = studentGroups.find((group) => group._id === examGroupId);

  function downloadConsolidatedReport() {
    if (!selectedGroup || !selectedStudent) return;
    const params = new URLSearchParams({ studentId: selectedStudent._id });
    downloadFile(`/api/exams/results/consolidated/${selectedGroup._id}/pdf?${params}`, `report-card-${selectedStudent.admissionNo}.pdf`);
  }

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
          <div className="font-medium mb-2">Consolidated report card (PDF)</div>
          <div className="text-xs text-gray-500 mb-2">Choose a student and exam group to download one report card with all subjects.</div>
          <Field label="Search student"><input className="input mb-2 max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, ID, or roll number" /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Student"><select className="input w-full" value={studentId} onChange={(event) => { setStudentId(event.target.value); setExamGroupId(""); }}><option value="">Select student…</option>{students.data?.items?.map((student) => <option key={student._id} value={student._id}>{student.user?.name} · {student.admissionNo}</option>)}</select></Field>
            <Field label="Exam / term"><select className="input w-full" value={examGroupId} onChange={(event) => setExamGroupId(event.target.value)} disabled={!studentId}><option value="">Select published exam…</option>{studentGroups.map((group) => <option key={group._id} value={group._id}>{group.name}{group.term ? ` · ${group.term}` : ""}{group.year ? ` · ${group.year}` : ""} · {group.class?.name}</option>)}</select></Field>
          </div>
          {resultGroups.isError && <p role="alert" className="mt-2 text-sm text-red-600">Could not load published exam groups for report cards.</p>}
          <button type="button" className="btn-primary mt-3 justify-center" disabled={!selectedStudent || !selectedGroup} onClick={downloadConsolidatedReport}>Download consolidated report card</button>
          <Pagination page={page} total={students.data?.total || 0} limit={25} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
