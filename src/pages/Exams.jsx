import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, Modal, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

function createBlankExam() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  return {
    name: "",
    term: "",
    class: "",
    subject: "",
    date: localDate,
    maxMarks: "100",
    passMarks: "33",
  };
}

function percentage(marks, maxMarks) {
  return maxMarks ? marks / maxMarks * 100 : 0;
}

function gradeFor(marks, maxMarks, passMarks) {
  if (marks < passMarks) return "F";
  const score = percentage(marks, maxMarks);
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "E";
}

export default function Exams() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManageExams = isAdmin || user?.role === "teacher";
  const qc = useQueryClient();
  const [tab, setTab] = useState(canManageExams ? "exams" : "results");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedSearch(search, () => setPage(1));
  const [selectedExamId, setSelectedExamId] = useState("");
  const [entries, setEntries] = useState({});
  const [markSearch, setMarkSearch] = useState("");
  const [markFilter, setMarkFilter] = useState("all");
  const [expandedResultKey, setExpandedResultKey] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createBlankExam);

  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data), enabled: user?.role !== "student" });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api.get("/subjects").then(r => r.data), enabled: canManageExams });
  const exams = useQuery({
    queryKey: ["exams", classFilter, page],
    queryFn: async () => {
      const response = await api.get("/exams", { params: { ...(classFilter && { class: classFilter }), page, limit: 25 } });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });
  const markSheet = useQuery({
    queryKey: ["exam-mark-sheet", selectedExamId],
    queryFn: () => api.get(`/exams/${selectedExamId}/mark-sheet`).then(r => r.data),
    enabled: canManageExams && !!selectedExamId && tab === "marks",
  });
  const consolidatedResults = useQuery({
    queryKey: ["consolidated-exam-results", user?.role, classFilter],
    queryFn: () => api.get("/exams/results/consolidated", { params: user?.role === "admin" && classFilter ? { class: classFilter } : {} }).then((response) => response.data),
    enabled: tab === "results" && user?.role === "student",
  });
  const adminStudentResults = useQuery({
    queryKey: ["admin-consolidated-student-results", classFilter, debouncedSearch, page],
    queryFn: async ({ signal }) => {
      const response = await api.get("/exams/results/consolidated/students", { params: {
        ...(classFilter && { class: classFilter }),
        ...(debouncedSearch && { q: debouncedSearch }),
        page,
        limit: 25,
      }, signal });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
    enabled: tab === "results" && isAdmin,
  });
  useEffect(() => {
    if (!markSheet.data) return;
    setEntries(Object.fromEntries(markSheet.data.students.map((student) => [student._id, {
      marks: student.marks === "" ? "" : String(student.marks),
      attendance: student.attendance,
    }])));
  }, [markSheet.data]);

  const createExam = useMutation({
    mutationFn: (body) => api.post("/exams", body),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      setOpen(false);
      setForm(createBlankExam());
      setSelectedExamId(data._id);
      setTab("marks");
    },
  });
  const saveMarks = useMutation({
    mutationFn: (body) => api.put(`/exams/${selectedExamId}/marks`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["exam-mark-sheet", selectedExamId] });
    },
  });
  const publish = useMutation({
    mutationFn: () => api.put(`/exams/${selectedExamId}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["exam-mark-sheet", selectedExamId] });
    },
  });
  const unpublish = useMutation({
    mutationFn: (examId) => api.put(`/exams/${examId}/unpublish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      if (selectedExamId) qc.invalidateQueries({ queryKey: ["exam-mark-sheet", selectedExamId] });
    },
  });
  const deleteExam = useMutation({
    mutationFn: (examId) => api.delete(`/exams/${examId}`),
    onSuccess: (_, examId) => {
      if (selectedExamId === examId) setSelectedExamId("");
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  const availableSubjects = subjects.data?.filter((subject) =>
    subject.class?._id === form.class
  ) || [];

  const examItems = exams.data?.items || [];
  const publishedExams = examItems.filter((exam) => exam.status === "published");
  const resultRecords = useMemo(() => publishedExams.flatMap((exam) =>
    (exam.marks || []).map((entry) => {
      const maxMarks = exam.maxMarks || entry.maxMarks || 100;
      const passMarks = exam.passMarks ?? Math.ceil(maxMarks * 0.33);
      return {
        exam,
        entry,
        student: entry.student,
        maxMarks,
        passMarks,
        percentage: entry.attendance === "absent" ? 0 : percentage(entry.marks, maxMarks),
        result: entry.attendance === "absent" ? "Absent" : entry.marks >= passMarks ? "Pass" : "Fail",
      };
    })
  ), [publishedExams]);
  const visibleResults = resultRecords.filter((record) => {
    const text = `${record.student?.user?.name || ""} ${record.student?.admissionNo || ""} ${record.student?.rollNo || ""} ${record.exam.name} ${record.exam.subject?.name || ""} ${record.exam.class?.name || ""} ${record.exam.class?.section || ""}`.toLowerCase();
    return (!classFilter || record.exam.class?._id === classFilter) && text.includes(search.toLowerCase());
  });
  const visibleExams = examItems.filter((exam) => {
    const text = `${exam.name} ${exam.term || ""} ${exam.subject?.name || ""} ${exam.class?.name || ""} ${exam.class?.section || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }) || [];
  function submitExam(event) {
    event.preventDefault();
    createExam.mutate({
      ...form,
      maxMarks: Number(form.maxMarks),
      passMarks: Number(form.passMarks),
    });
  }

  function submitMarks() {
    const marks = Object.entries(entries).flatMap(([student, value]) => {
      if (value.attendance === "absent") return [{ student, marks: 0, attendance: "absent" }];
      if (value.marks === "") return [];
      return [{ student, marks: Number(value.marks), attendance: "present" }];
    });
    saveMarks.mutate({ marks });
  }

  async function downloadReportCard(group) {
    try {
      const query = group.studentId ? `?studentId=${encodeURIComponent(group.studentId)}` : "";
      const response = await api.get(`/exams/results/consolidated/${group._id}/pdf${query}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${isAdmin && !group.studentId ? "class-report-cards" : "report-card"}-${String(group.name).replace(/[^a-z\d_-]/gi, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert("Could not download report card. Please try again.");
    }
  }

  const selectedExam = examItems.find((exam) => exam._id === selectedExamId);
  const markStudents = markSheet.data?.students || [];
  const completeMarkCount = markStudents.filter((student) => {
    const entry = entries[student._id];
    return entry && (entry.attendance === "absent" || entry.marks !== "");
  }).length;
  const pendingMarkCount = Math.max(0, markStudents.length - completeMarkCount);
  const passCount = markStudents.filter((student) => {
    const entry = entries[student._id];
    return entry?.attendance === "present" && entry.marks !== "" && Number(entry.marks) >= Number(markSheet.data?.exam.passMarks || 0);
  }).length;
  const filteredMarkStudents = markStudents.filter((student) => {
    const entry = entries[student._id] || { marks: "", attendance: "present" };
    const query = markSearch.trim().toLowerCase();
    const matchesSearch = !query || `${student.name} ${student.admissionNo} ${student.rollNo || ""}`.toLowerCase().includes(query);
    const complete = entry.attendance === "absent" || entry.marks !== "";
    const matchesFilter = markFilter === "all" || (markFilter === "pending" ? !complete : complete);
    return matchesSearch && matchesFilter;
  });
  const hasIncompleteMarks = markSheet.data?.students.some((student) => {
    const entry = entries[student._id];
    return !entry || (entry.attendance === "present" && entry.marks === "");
  });
  const adminResultRows = adminStudentResults.data?.items || [];
  const adminReportCount = adminResultRows.reduce((total, item) => total + item.reportCards.length, 0);

  return (
    <div>
      <PageHeader
        title="Examinations & Results"
        subtitle={isAdmin ? "Set up exams, record marks, and declare student results" : user?.role === "teacher" ? "Manage exams and record marks for your assigned classes and subjects" : "Published examination results"}
        actions={canManageExams && <button className="btn-primary justify-center" onClick={() => { setForm(createBlankExam()); createExam.reset(); setOpen(true); }}>Create exam</button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {canManageExams && <button type="button" className={tab === "exams" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("exams")}>Exams & marks</button>}
        {canManageExams && <button type="button" className={tab === "marks" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("marks")}>Save marks{selectedExam ? ` (${selectedExam.marks?.length || 0}/${selectedExam.studentCount || 0})` : ""}</button>}
        <button type="button" className={tab === "results" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("results")}>Result records</button>
      </div>

      {tab !== "marks" && <div className={`card mb-4 grid grid-cols-1 gap-3 ${user?.role === "student" ? "" : "sm:grid-cols-2"}`}>
        <Field label="Search"><input className="input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "results" && isAdmin ? "Student name, admission number, or roll" : tab === "results" ? "Student, exam, subject, or class" : "Exam, term, subject, or class"} /></Field>
        {user?.role !== "student" && <Field label="Class"><select className="input" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1); setSelectedExamId(""); }}><option value="">All classes</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>}
      </div>}

      {classes.isError && <p role="alert" className="mb-3 text-sm text-red-600">{classes.error.response?.data?.error || "Could not load classes"}</p>}
      {subjects.isError && <p role="alert" className="mb-3 text-sm text-red-600">{subjects.error.response?.data?.error || "Could not load subjects"}</p>}
      {exams.isLoading && <div className="card text-sm text-slate-500">Loading exams…</div>}
      {exams.isError && <p role="alert" className="mb-3 text-sm text-red-600">{exams.error.response?.data?.error || "Could not load exams"}</p>}

      {tab === "exams" && canManageExams && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card"><span className="text-xs text-slate-500">Exams shown</span><strong className="mt-1 block text-2xl">{visibleExams.length}</strong></div>
            <div className="card"><span className="text-xs text-slate-500">Drafts</span><strong className="mt-1 block text-2xl text-amber-700">{visibleExams.filter((exam) => exam.status !== "published").length}</strong></div>
            <div className="card"><span className="text-xs text-slate-500">Published</span><strong className="mt-1 block text-2xl text-green-700">{visibleExams.filter((exam) => exam.status === "published").length}</strong></div>
          </div>
          <div className="card p-0 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="th">Exam</th><th className="th">Term</th><th className="th">Class</th><th className="th">Subject</th><th className="th">Date</th><th className="th">Marks</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
              <tbody>{visibleExams.map((exam) => <tr key={exam._id} className={`border-t border-gray-100 ${selectedExamId === exam._id ? "bg-brand-50/50" : ""}`}>
                <td className="td font-medium">{exam.name}</td><td className="td">{exam.term || "—"}</td><td className="td">{exam.class?.name} · {exam.class?.section || "A"}</td><td className="td">{exam.subject?.name}</td><td className="td">{exam.date ? new Date(exam.date).toLocaleDateString() : "—"}</td><td className="td">{exam.marks?.length || 0} / {exam.studentCount || 0}</td>
                <td className="td"><span className={`rounded px-2 py-0.5 text-xs ${exam.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{exam.status || "draft"}</span></td>
                <td className="td whitespace-nowrap">
                  <button type="button" className="mr-3 text-brand-700 hover:underline" onClick={() => { setSelectedExamId(exam._id); setTab("marks"); setMarkSearch(""); setMarkFilter("all"); saveMarks.reset(); publish.reset(); }}>Enter marks</button>
                  {isAdmin && (exam.status === "published"
                    ? <button type="button" className="mr-3 text-amber-700 hover:underline" onClick={() => confirm("Unpublish these results? Students will no longer see them.") && unpublish.mutate(exam._id)}>Unpublish</button>
                    : <button type="button" className="mr-3 text-green-700 hover:underline" onClick={() => { setSelectedExamId(exam._id); setTab("marks"); publish.reset(); }}>Declare results</button>)}
                  {isAdmin && exam.status !== "published" && <button type="button" className="text-red-600 hover:underline" onClick={() => confirm("Delete this draft exam?") && deleteExam.mutate(exam._id)}>Delete</button>}
                </td>
              </tr>)}
                {!exams.isLoading && !exams.isError && !visibleExams.length && <tr><td className="td text-center text-slate-500" colSpan="8">No exams found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={exams.data?.total || 0} limit={25} onChange={setPage} />
        </div>
      )}

      {tab === "marks" && canManageExams && (
        <div className="space-y-4">
          <section className="card grid grid-cols-1 gap-4 sm:grid-cols-[minmax(16rem,1fr)_minmax(12rem,2fr)] sm:items-end">
            <Field label="Select exam"><select className="input w-full" value={selectedExamId} onChange={(event) => { setSelectedExamId(event.target.value); saveMarks.reset(); publish.reset(); setMarkSearch(""); setMarkFilter("all"); }}><option value="">Choose an exam</option>{examItems.map((exam) => <option key={exam._id} value={exam._id}>{exam.name} · {exam.class?.name} · {exam.subject?.name}</option>)}</select></Field>
            <div className="text-sm text-slate-500">Enter marks for the full class roster, mark absent students, then save the draft. Results become visible only after they are declared.</div>
          </section>
          {!selectedExamId && <div className="card text-sm text-slate-500">Choose an exam to enter class marks.</div>}
          {selectedExamId && markSheet.isLoading && <div className="card text-sm text-slate-500">Loading student mark sheet…</div>}
          {markSheet.isError && <div role="alert" className="card text-sm text-red-600">{markSheet.error.response?.data?.error || "Could not load mark sheet"}</div>}
          {markSheet.data && <section className="card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-semibold">{selectedExam?.name || markSheet.data.exam.name} · {selectedExam?.subject?.name || "Exam marks"}</h2><p className="text-sm text-slate-500">{selectedExam?.class?.name || "Class"} · Section {selectedExam?.class?.section || "A"} · Maximum {markSheet.data.exam.maxMarks} · Pass {markSheet.data.exam.passMarks}</p></div>
              {markSheet.data.exam.status === "published" && <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Results published</span>}
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Completed</span><strong className="text-xl">{completeMarkCount} / {markStudents.length}</strong></div>
              <div className="rounded-xl bg-amber-50 p-3"><span className="block text-xs text-amber-700">Pending</span><strong className="text-xl text-amber-900">{pendingMarkCount}</strong></div>
              <div className="rounded-xl bg-green-50 p-3"><span className="block text-xs text-green-700">Currently passing</span><strong className="text-xl text-green-900">{passCount}</strong></div>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${markStudents.length ? completeMarkCount / markStudents.length * 100 : 0}%` }} /></div>
            {markSheet.data.exam.status !== "published" ? <>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_12rem]">
                <Field label="Find student"><input className="input w-full" value={markSearch} onChange={(event) => setMarkSearch(event.target.value)} placeholder="Name, admission number, or roll" /></Field>
                <Field label="Show"><select className="input w-full" value={markFilter} onChange={(event) => setMarkFilter(event.target.value)}><option value="all">All students</option><option value="pending">Pending marks</option><option value="complete">Completed</option></select></Field>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="th">Roll No.</th><th className="th">Student</th><th className="th">Student ID</th><th className="th">Attendance</th><th className="th">Marks / {markSheet.data.exam.maxMarks}</th><th className="th">Result</th></tr></thead>
                  <tbody>{filteredMarkStudents.map((student) => {
                    const entry = entries[student._id] || { marks: "", attendance: "present" };
                    const achieved = entry.attendance === "absent" ? 0 : Number(entry.marks);
                    const complete = entry.attendance === "absent" || entry.marks !== "";
                    return <tr key={student._id} className="border-t border-gray-100">
                      <td className="td">{student.rollNo || "—"}</td><td className="td">{student.name}</td><td className="td font-mono text-xs">{student.admissionNo}</td>
                      <td className="td"><select className="input py-1" value={entry.attendance} onChange={(event) => setEntries((current) => ({ ...current, [student._id]: { ...entry, attendance: event.target.value, marks: event.target.value === "absent" ? "0" : entry.attendance === "absent" ? "" : entry.marks } }))}><option value="present">Present</option><option value="absent">Absent</option></select></td>
                      <td className="td"><input className="input w-28 py-1" type="number" min="0" max={markSheet.data.exam.maxMarks} step="0.01" value={entry.marks} disabled={entry.attendance === "absent"} onChange={(event) => setEntries((current) => ({ ...current, [student._id]: { ...entry, marks: event.target.value } }))} placeholder="Enter marks" /></td>
                      <td className="td">{!complete ? <span className="text-amber-700">Pending</span> : entry.attendance === "absent" ? "Absent" : achieved >= markSheet.data.exam.passMarks ? <span className="text-green-700">Pass</span> : <span className="text-red-700">Fail</span>}</td>
                    </tr>;
                  })}
                    {!filteredMarkStudents.length && <tr><td className="td text-center text-slate-500" colSpan="6">No students match this search or filter.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{pendingMarkCount ? `${pendingMarkCount} student${pendingMarkCount === 1 ? "" : "s"} still need marks or attendance.` : "The full class roster is complete and ready for result declaration."}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost justify-center" disabled={saveMarks.isPending || !markStudents.length} onClick={submitMarks}>{saveMarks.isPending ? "Saving…" : "Save marks"}</button>
                  {isAdmin && <button type="button" className="btn-primary justify-center" disabled={publish.isPending || hasIncompleteMarks || !markStudents.length} onClick={() => publish.mutate()}>{publish.isPending ? "Declaring…" : "Declare results"}</button>}
                </div>
              </div>
            </> : <ResultTable exam={markSheet.data.exam} records={markSheet.data.students.map((student) => ({ student, entry: markSheet.data.exam.marks.find((mark) => String(mark.student) === student._id) })).filter((record) => record.entry)} />}
            {saveMarks.isError && <p role="alert" className="mt-3 text-sm text-red-600">{saveMarks.error.response?.data?.error || "Could not save marks"}</p>}
            {saveMarks.isSuccess && <p role="status" className="mt-3 text-sm text-green-700">{isAdmin ? "Marks saved as a draft. Declare results when ready." : "Marks saved as a draft. An administrator can declare the results when ready."}</p>}
            {publish.isError && <p role="alert" className="mt-3 text-sm text-red-600">{publish.error.response?.data?.error || "Could not declare results"}</p>}
            {publish.isSuccess && <p role="status" className="mt-3 text-sm text-green-700">Results declared and visible to students.</p>}
            {unpublish.isError && <p role="alert" className="mt-3 text-sm text-red-600">{unpublish.error.response?.data?.error || "Could not unpublish results"}</p>}
          </section>}
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          {isAdmin && <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Students with results: <strong>{adminStudentResults.data?.total || 0}</strong></span>
              <span>Report cards on this page: <strong>{adminReportCount}</strong></span>
              <span>Class: <strong>{classes.data?.find((item) => item._id === classFilter)?.name || "All classes"}</strong></span>
            </div>
            {adminStudentResults.isLoading && <div className="card text-sm text-slate-500">Loading student result records…</div>}
            {adminStudentResults.isError && <div role="alert" className="card text-sm text-red-600">{adminStudentResults.error.response?.data?.error || "Could not load student results"}</div>}
            <div className="card p-0 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="th">Student</th><th className="th">Class</th><th className="th">Exam results</th><th className="th">Actions</th></tr></thead>
                <tbody>{adminResultRows.map((item) => {
                  const student = item.student;
                  const expanded = expandedResultKey === student._id;
                  return <Fragment key={student._id}>
                    <tr className="border-t border-gray-100">
                      <td className="td"><div className="font-medium">{student.name}</div><div className="text-xs text-slate-500">ID {student.admissionNo} · Roll {student.rollNo || "—"}</div></td>
                      <td className="td">{student.class?.name} · Section {student.class?.section || "A"}</td>
                      <td className="td">{item.reportCards.length} consolidated report{item.reportCards.length === 1 ? "" : "s"}</td>
                      <td className="td"><button type="button" className="text-brand-700 hover:underline" onClick={() => setExpandedResultKey(expanded ? "" : student._id)}>{expanded ? "Hide results" : "View results"}</button></td>
                    </tr>
                    {expanded && <tr className="border-t border-slate-100 bg-slate-50"><td colSpan="4" className="space-y-3 p-3">
                      {item.reportCards.map((reportCard) => <section key={reportCard._id} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3"><div><h3 className="font-semibold">{reportCard.name}{reportCard.term ? ` · ${reportCard.term}` : ""}{reportCard.year ? ` · ${reportCard.year}` : ""}</h3><p className="text-xs text-slate-500">Total {reportCard.totalMarks}/{reportCard.totalMaxMarks} · {reportCard.percentage.toFixed(1)}% · {reportCard.result}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-ghost justify-center" onClick={() => downloadReportCard({ ...reportCard, studentId: student._id })}>Student PDF</button><button type="button" className="btn-primary justify-center" onClick={() => downloadReportCard(reportCard)}>Class PDF</button></div></div>
                        <table className="w-full"><thead className="bg-slate-100"><tr><th className="th">Subject</th><th className="th">Full marks</th><th className="th">Pass marks</th><th className="th">Marks</th><th className="th">Status</th></tr></thead><tbody>{reportCard.subjects.map((subject) => { const pass = subject.attendance !== "absent" && subject.marks >= subject.passMarks; return <tr key={subject.examId} className="border-t border-slate-100"><td className="td">{subject.name}</td><td className="td">{subject.maxMarks}</td><td className="td">{subject.passMarks}</td><td className="td">{subject.attendance === "absent" ? "Absent" : subject.marks}</td><td className="td">{subject.attendance === "absent" ? "Absent" : pass ? "Pass" : "Fail"}</td></tr>; })}</tbody></table>
                      </section>)}
                    </td></tr>}
                  </Fragment>;
                })}
                  {!adminStudentResults.isLoading && !adminStudentResults.isError && !adminResultRows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan="4">No published student results match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={adminStudentResults.data?.total || 0} limit={25} onChange={setPage} />
          </>}
          {user?.role === "student" && <>
            {consolidatedResults.isLoading && <div className="card text-sm text-slate-500">Loading consolidated report cards…</div>}
            {consolidatedResults.isError && <div role="alert" className="card text-sm text-red-600">{consolidatedResults.error.response?.data?.error || "Could not load consolidated results"}</div>}
            {consolidatedResults.data?.map((group) => (
              <section key={group._id} className="card p-0 overflow-x-auto">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div><h2 className="text-lg font-semibold">{group.name}{group.term ? ` · ${group.term}` : ""}{group.year ? ` · ${group.year}` : ""}</h2><p className="text-sm text-slate-500">{group.class?.name} · Section {group.class?.section || "A"}{group.date ? ` · ${new Date(group.date).toLocaleDateString()}` : ""}</p></div>
                  <button type="button" className="btn-primary justify-center" onClick={() => downloadReportCard(group)}>Download report card</button>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="th">Subject</th><th className="th">Full marks</th><th className="th">Passing marks</th><th className="th">Marks</th><th className="th">Result</th></tr></thead>
                  <tbody>{group.subjects.map((subject) => {
                    const score = subject.attendance === "absent" ? 0 : Number(subject.marks || 0);
                    const passed = subject.attendance !== "absent" && score >= subject.passMarks;
                    return <tr key={subject.examId} className="border-t border-gray-100"><td className="td">{subject.name}</td><td className="td">{subject.maxMarks}</td><td className="td">{subject.passMarks}</td><td className="td">{subject.attendance === "absent" ? "Absent" : score}</td><td className="td">{subject.attendance === "absent" ? "Absent" : passed ? "Pass" : "Fail"}</td></tr>;
                  })}
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold"><td className="td">Total / percentage</td><td className="td">{group.totalMaxMarks}</td><td className="td">—</td><td className="td">{group.totalMarks}</td><td className="td">{group.percentage.toFixed(1)}% · {group.result}</td></tr>
                  </tbody>
                </table>
              </section>
            ))}
            {!consolidatedResults.isLoading && !consolidatedResults.isError && !consolidatedResults.data?.length && <div className="card text-center text-sm text-slate-500">No results have been declared yet.</div>}
          </>}
          {!isAdmin && user?.role !== "student" && <>
            <div className="flex flex-wrap gap-4 text-sm"><span>Published exams: <strong>{publishedExams.length}</strong></span><span>Result records: <strong>{visibleResults.length}</strong></span></div>
            <ResultTable records={visibleResults} />
            <Pagination page={page} total={exams.data?.total || 0} limit={25} onChange={setPage} />
            {!exams.isLoading && !exams.isError && !visibleResults.length && <div className="card text-center text-sm text-slate-500">No published result records match your filters.</div>}
          </>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create exam">
        <form onSubmit={submitExam} className="space-y-3">
          {createExam.isError && <p role="alert" className="text-sm text-red-600">{createExam.error.response?.data?.error || "Could not create exam"}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Exam name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Mid-term examination" required /></Field>
            <Field label="Term / session"><input className="input" value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })} placeholder="e.g. Term 1, 2026" /></Field>
            <Field label="Class"><select className="input" value={form.class} onChange={(event) => setForm({ ...form, class: event.target.value, subject: "" })} required><option value="">Select class</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>
            <Field label="Subject"><select className="input" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required disabled={!form.class}><option value="">Select subject</option>{availableSubjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}{subject.code ? ` (${subject.code})` : ""}</option>)}</select></Field>
            <Field label="Exam date"><input className="input" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
            <Field label="Maximum marks"><input className="input" type="number" min="0.01" step="0.01" value={form.maxMarks} onChange={(event) => { const maxMarks = event.target.value; setForm({ ...form, maxMarks, passMarks: Number(form.passMarks) > Number(maxMarks) ? String(Math.ceil(Number(maxMarks) * 0.33)) : form.passMarks }); }} required /></Field>
            <Field label="Passing marks"><input className="input" type="number" min="0" step="0.01" max={form.maxMarks} value={form.passMarks} onChange={(event) => setForm({ ...form, passMarks: event.target.value })} required /></Field>
          </div>
          <p className="text-xs text-slate-500">This exam is assigned to the whole selected class. Its mark sheet includes every enrolled student.</p>
          <p className="text-xs text-slate-500">New exams are drafts. Students only see results after the administrator declares them.</p>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary justify-center" disabled={createExam.isPending}>{createExam.isPending ? "Creating…" : "Create exam"}</button></div>
        </form>
      </Modal>
    </div>
  );
}

function ResultTable({ exam, records }) {
  return (
    <div className="card p-0 overflow-x-auto">
      {exam && <div className="p-4"><h2 className="font-semibold">{exam.name} · {exam.subject?.name}</h2><p className="text-sm text-slate-500">{exam.class?.name} · Section {exam.class?.section || "A"} · {exam.term || "No term"}</p></div>}
      <table className="w-full">
        <thead className="bg-gray-50"><tr><th className="th">Student</th><th className="th">Roll No.</th><th className="th">Student ID</th>{!exam && <><th className="th">Exam</th><th className="th">Subject</th><th className="th">Class</th><th className="th">Term</th></>}<th className="th">Marks</th><th className="th">Percentage</th><th className="th">Grade</th><th className="th">Result</th></tr></thead>
        <tbody>{records.map((record, index) => {
          const currentExam = record.exam || exam;
          const entry = record.entry;
          const student = record.student || entry?.student;
          const maxMarks = record.maxMarks || currentExam?.maxMarks || entry?.maxMarks || 100;
          const passMarks = record.passMarks ?? currentExam?.passMarks ?? Math.ceil(maxMarks * 0.33);
          const isAbsent = entry?.attendance === "absent";
          const score = entry?.marks ?? 0;
          const result = record.result || (isAbsent ? "Absent" : score >= passMarks ? "Pass" : "Fail");
          const ratio = record.percentage ?? (isAbsent ? 0 : percentage(score, maxMarks));
          return <tr key={`${currentExam?._id}-${student?._id}-${index}`} className="border-t border-gray-100">
            <td className="td">{student?.user?.name || "—"}</td><td className="td">{student?.rollNo || "—"}</td><td className="td font-mono text-xs">{student?.admissionNo || "—"}</td>
            {!exam && <><td className="td">{currentExam?.name}</td><td className="td">{currentExam?.subject?.name}</td><td className="td">{currentExam?.class?.name} · {currentExam?.class?.section || "A"}</td><td className="td">{currentExam?.term || "—"}</td></>}
            <td className="td">{isAbsent ? "Absent" : `${score} / ${maxMarks}`}</td><td className="td">{ratio.toFixed(1)}%</td><td className="td">{isAbsent ? "—" : gradeFor(score, maxMarks, passMarks)}</td>
            <td className="td"><span className={`rounded px-2 py-0.5 text-xs ${result === "Pass" ? "bg-green-100 text-green-700" : result === "Fail" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{result}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}
