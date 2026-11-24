import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, Modal, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";

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
  const [selectedExamId, setSelectedExamId] = useState("");
  const [entries, setEntries] = useState({});
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
    enabled: canManageExams && !!selectedExamId && tab === "exams",
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
      setTab("exams");
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
    !subject.class || subject.class._id === form.class
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

  const selectedExam = examItems.find((exam) => exam._id === selectedExamId);
  const hasIncompleteMarks = markSheet.data?.students.some((student) => {
    const entry = entries[student._id];
    return !entry || (entry.attendance === "present" && entry.marks === "");
  });

  return (
    <div>
      <PageHeader
        title="Examinations & Results"
        subtitle={isAdmin ? "Set up exams, record marks, and declare student results" : user?.role === "teacher" ? "Manage exams and record marks for your assigned classes and subjects" : "Published examination results"}
        actions={canManageExams && <button className="btn-primary justify-center" onClick={() => { setForm(createBlankExam()); createExam.reset(); setOpen(true); }}>Create exam</button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {canManageExams && <button type="button" className={tab === "exams" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("exams")}>Exams & marks</button>}
        <button type="button" className={tab === "results" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("results")}>Result records</button>
      </div>

      <div className={`card mb-4 grid grid-cols-1 gap-3 ${user?.role === "student" ? "" : "sm:grid-cols-2"}`}>
        <Field label="Search"><input className="input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "results" ? "Student, exam, subject, or class" : "Exam, term, subject, or class"} /></Field>
        {user?.role !== "student" && <Field label="Class"><select className="input" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1); setSelectedExamId(""); }}><option value="">All classes</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>}
      </div>

      {classes.isError && <p role="alert" className="mb-3 text-sm text-red-600">{classes.error.response?.data?.error || "Could not load classes"}</p>}
      {subjects.isError && <p role="alert" className="mb-3 text-sm text-red-600">{subjects.error.response?.data?.error || "Could not load subjects"}</p>}
      {exams.isLoading && <div className="card text-sm text-slate-500">Loading exams…</div>}
      {exams.isError && <p role="alert" className="mb-3 text-sm text-red-600">{exams.error.response?.data?.error || "Could not load exams"}</p>}

      {tab === "exams" && canManageExams && (
        <div className="space-y-4">
          <div className="card p-0 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="th">Exam</th><th className="th">Term</th><th className="th">Class</th><th className="th">Subject</th><th className="th">Date</th><th className="th">Marks</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
              <tbody>{visibleExams.map((exam) => <tr key={exam._id} className={`border-t border-gray-100 ${selectedExamId === exam._id ? "bg-brand-50/50" : ""}`}>
                <td className="td font-medium">{exam.name}</td><td className="td">{exam.term || "—"}</td><td className="td">{exam.class?.name} · {exam.class?.section || "A"}</td><td className="td">{exam.subject?.name}</td><td className="td">{exam.date ? new Date(exam.date).toLocaleDateString() : "—"}</td><td className="td">{exam.marks?.length || 0}</td>
                <td className="td"><span className={`rounded px-2 py-0.5 text-xs ${exam.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{exam.status || "draft"}</span></td>
                <td className="td whitespace-nowrap">
                  <button type="button" className="mr-3 text-brand-700 hover:underline" onClick={() => { setSelectedExamId(exam._id); setTab("exams"); saveMarks.reset(); publish.reset(); }}>Enter marks</button>
                  {isAdmin && (exam.status === "published"
                    ? <button type="button" className="mr-3 text-amber-700 hover:underline" onClick={() => confirm("Unpublish these results? Students will no longer see them.") && unpublish.mutate(exam._id)}>Unpublish</button>
                    : <button type="button" className="mr-3 text-green-700 hover:underline" onClick={() => { setSelectedExamId(exam._id); setTab("exams"); publish.reset(); }}>Declare results</button>)}
                  {isAdmin && exam.status !== "published" && <button type="button" className="text-red-600 hover:underline" onClick={() => confirm("Delete this draft exam?") && deleteExam.mutate(exam._id)}>Delete</button>}
                </td>
              </tr>)}
                {!exams.isLoading && !exams.isError && !visibleExams.length && <tr><td className="td text-center text-slate-500" colSpan="8">No exams found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={exams.data?.total || 0} limit={25} onChange={setPage} />

          {selectedExamId && (
            <section className="card">
              {markSheet.isLoading && <p className="text-sm text-slate-500">Loading student mark sheet…</p>}
              {markSheet.isError && <p role="alert" className="text-sm text-red-600">{markSheet.error.response?.data?.error || "Could not load mark sheet"}</p>}
              {markSheet.data && <>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div><h2 className="text-lg font-semibold">{selectedExam?.name || markSheet.data.exam.name} · {selectedExam?.subject?.name}</h2><p className="text-sm text-slate-500">{selectedExam?.class?.name} · Section {selectedExam?.class?.section || "A"} · Max {markSheet.data.exam.maxMarks} · Pass {markSheet.data.exam.passMarks}</p></div>
                  {markSheet.data.exam.status === "published" && <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Results published</span>}
                </div>
                {markSheet.data.exam.status !== "published" ? <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr><th className="th">Roll No.</th><th className="th">Student</th><th className="th">Student ID</th><th className="th">Attendance</th><th className="th">Marks / {markSheet.data.exam.maxMarks}</th><th className="th">Result</th></tr></thead>
                      <tbody>{markSheet.data.students.map((student) => {
                        const entry = entries[student._id] || { marks: "", attendance: "present" };
                        const achieved = entry.attendance === "absent" ? 0 : Number(entry.marks);
                        const complete = entry.attendance === "absent" || entry.marks !== "";
                        return <tr key={student._id} className="border-t border-gray-100">
                          <td className="td">{student.rollNo || "—"}</td><td className="td">{student.name}</td><td className="td font-mono text-xs">{student.admissionNo}</td>
                          <td className="td"><select className="input py-1" value={entry.attendance} onChange={(event) => setEntries({ ...entries, [student._id]: { ...entry, attendance: event.target.value, marks: event.target.value === "absent" ? "0" : entry.attendance === "absent" ? "" : entry.marks } })}><option value="present">Present</option><option value="absent">Absent</option></select></td>
                          <td className="td"><input className="input w-28 py-1" type="number" min="0" max={markSheet.data.exam.maxMarks} step="0.01" value={entry.marks} disabled={entry.attendance === "absent"} onChange={(event) => setEntries({ ...entries, [student._id]: { ...entry, marks: event.target.value } })} placeholder="Enter marks" /></td>
                          <td className="td">{!complete ? "Pending" : entry.attendance === "absent" ? "Absent" : achieved >= markSheet.data.exam.passMarks ? "Pass" : "Fail"}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Enter marks or mark each student absent. All students need a record before results can be declared.</p>
                    <div className="flex gap-2">
                      <button type="button" className="btn-ghost justify-center" disabled={saveMarks.isPending || !markSheet.data.students.length} onClick={submitMarks}>{saveMarks.isPending ? "Saving…" : "Save marks"}</button>
                      {isAdmin && <button type="button" className="btn-primary justify-center" disabled={publish.isPending || hasIncompleteMarks || !markSheet.data.students.length} onClick={() => publish.mutate()}>{publish.isPending ? "Declaring…" : "Declare results"}</button>}
                    </div>
                  </div>
                </> : <ResultTable exam={markSheet.data.exam} records={markSheet.data.students.map((student) => ({ student, entry: markSheet.data.exam.marks.find((mark) => String(mark.student) === student._id) })).filter((record) => record.entry)} />}
                {saveMarks.isError && <p role="alert" className="mt-3 text-sm text-red-600">{saveMarks.error.response?.data?.error || "Could not save marks"}</p>}
                {saveMarks.isSuccess && <p role="status" className="mt-3 text-sm text-green-700">{isAdmin ? "Marks saved as a draft. Declare results when ready." : "Marks saved as a draft. An administrator can declare the results when ready."}</p>}
                {publish.isError && <p role="alert" className="mt-3 text-sm text-red-600">{publish.error.response?.data?.error || "Could not declare results"}</p>}
                {publish.isSuccess && <p role="status" className="mt-3 text-sm text-green-700">Results declared and visible to students.</p>}
                {unpublish.isError && <p role="alert" className="mt-3 text-sm text-red-600">{unpublish.error.response?.data?.error || "Could not unpublish results"}</p>}
                {deleteExam.isError && <p role="alert" className="mt-3 text-sm text-red-600">{deleteExam.error.response?.data?.error || "Could not delete exam"}</p>}
              </>}
            </section>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          {isAdmin && <div className="flex flex-wrap gap-4 text-sm"><span>Published exams: <strong>{publishedExams.length}</strong></span><span>Result records: <strong>{visibleResults.length}</strong></span></div>}
          <ResultTable records={visibleResults} />
          <Pagination page={page} total={exams.data?.total || 0} limit={25} onChange={setPage} />
          {!exams.isLoading && !exams.isError && !visibleResults.length && <div className="card text-center text-sm text-slate-500">{isAdmin || user?.role === "teacher" ? "No published result records match your filters." : "No results have been declared for your account yet."}</div>}
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
