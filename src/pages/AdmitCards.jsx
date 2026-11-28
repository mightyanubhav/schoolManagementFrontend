import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

function downloadName(name, student) {
  const examName = String(name || "exam").replace(/[^a-z\d_-]/gi, "_");
  return student ? `admit-card-${student.admissionNo || student._id}-${examName}.pdf` : `admit-card-${examName}.pdf`;
}

async function downloadAdmitCard(group, student, role) {
  const params = role === "admin" && student?._id ? `?studentId=${encodeURIComponent(student._id)}` : "";
  const response = await api.get(`/exams/${group._id}/admit-cards/pdf${params}`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName(group.name, student);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "To be announced";
}

export default function AdmitCards() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [scheduleDates, setScheduleDates] = useState({});
  const [downloadError, setDownloadError] = useState("");
  const debouncedStudentSearch = useDebouncedSearch(studentSearch, () => setStudentPage(1));

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/classes").then((response) => response.data),
    enabled: isAdmin,
  });
  const scheduleUpdate = useMutation({
    mutationFn: ({ examId, date }) => api.put(`/exams/${examId}/admit-card-schedule`, { date: date || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admit-card-groups"] }),
  });
  const groups = useQuery({
    queryKey: ["admit-card-groups", user?.role, classId],
    queryFn: () => api.get("/exams/admit-cards", { params: isAdmin ? { class: classId } : {} }).then((response) => response.data),
    enabled: !isAdmin || Boolean(classId),
  });
  const students = useQuery({
    queryKey: ["admit-card-students", classId, debouncedStudentSearch, studentPage],
    queryFn: async ({ signal }) => {
      const response = await api.get("/students", {
        params: {
          class: classId,
          ...(debouncedStudentSearch && { q: debouncedStudentSearch }),
          page: studentPage,
          limit: 25,
        },
        signal,
      });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
    enabled: isAdmin && Boolean(classId && groupId),
  });
  const studentGroups = !isAdmin ? groups.data || [] : [];
  const adminGroups = isAdmin ? groups.data || [] : [];
  const selectedGroup = (isAdmin ? adminGroups : studentGroups).find((group) => group._id === groupId);
  const selectedStudent = students.data?.items?.find((student) => student._id === studentId);

  useEffect(() => {
    setScheduleDates(Object.fromEntries((selectedGroup?.subjects || []).map((subject) => [
      subject.examId,
      subject.date ? new Date(subject.date).toISOString().slice(0, 10) : "",
    ])));
  }, [selectedGroup]);

  async function saveSchedule(examId) {
    setDownloadError("");
    try {
      await scheduleUpdate.mutateAsync({ examId, date: scheduleDates[examId] || "" });
    } catch (error) {
      setDownloadError(error.response?.data?.error || "Could not update the exam date.");
    }
  }

  async function issueCard(group, student) {
    setDownloadError("");
    try {
      await downloadAdmitCard(group, student, user?.role);
    } catch (error) {
      setDownloadError(error.response?.data?.error || "Could not generate the admit card.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Admit Cards"
        subtitle={isAdmin
          ? "Update exam dates and issue or reissue a student's complete admit card."
          : "View your scheduled subjects and download the complete admit card."}
      />

      {downloadError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{downloadError}</p>}

      {isAdmin ? (
        <div className="space-y-4">
          <section className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Class">
              <select className="input w-full" value={classId} onChange={(event) => {
                setClassId(event.target.value);
                setGroupId("");
                setStudentId("");
                setStudentSearch("");
                setStudentPage(1);
              }}>
                <option value="">Select class</option>
                {classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}
              </select>
            </Field>
            <Field label="Exam group">
              <select className="input w-full" value={groupId} onChange={(event) => {
                setGroupId(event.target.value);
                setStudentId("");
                setStudentSearch("");
                setStudentPage(1);
              }} disabled={!classId || groups.isLoading}>
                <option value="">Select exam group</option>
                {adminGroups.map((group) => <option key={group._id} value={group._id}>{group.name}{group.term ? ` · ${group.term}` : ""}{group.year ? ` · ${group.year}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Student">
              <select className="input w-full" value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!groupId || students.isLoading}>
                <option value="">Select student</option>
                {students.data?.items?.map((student) => <option key={student._id} value={student._id}>{student.user?.name} · {student.admissionNo}</option>)}
              </select>
            </Field>
            {groupId && <Field label="Find student">
              <input className="input w-full" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Type at least 2 letters" />
            </Field>}
          </section>

          {classes.isError && <p role="alert" className="text-sm text-red-600">{classes.error.response?.data?.error || "Could not load classes."}</p>}
          {groups.isLoading && classId && <div className="card text-sm text-slate-500">Loading exam groups…</div>}
          {groups.isError && <p role="alert" className="text-sm text-red-600">{groups.error.response?.data?.error || "Could not load exam groups."}</p>}
          {groupId && students.isError && <p role="alert" className="text-sm text-red-600">{students.error.response?.data?.error || "Could not load students."}</p>}
          {groupId && !students.isLoading && students.data?.total === 0 && <div className="card text-sm text-slate-500">No students match this search in the selected class.</div>}

          {selectedGroup && <section className="card p-0 overflow-x-auto">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedGroup.name}{selectedGroup.term ? ` · ${selectedGroup.term}` : ""}{selectedGroup.year ? ` · ${selectedGroup.year}` : ""}</h2>
                <p className="text-sm text-slate-500">{selectedGroup.class?.name} · Section {selectedGroup.class?.section || "A"} · {selectedGroup.subjects.length} subject{selectedGroup.subjects.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" className="btn-primary justify-center" disabled={!selectedStudent} onClick={() => issueCard(selectedGroup, selectedStudent)}>
                Issue / reissue selected student's card
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="th">Subject</th><th className="th">Subject code</th><th className="th">Exam date</th><th className="th">Update schedule</th></tr></thead>
              <tbody>{selectedGroup.subjects.map((subject) => (
                <tr key={subject.examId} className="border-t border-gray-100">
                  <td className="td">{subject.name}</td>
                  <td className="td">{subject.code || "—"}</td>
                  <td className="td">{displayDate(subject.date)}</td>
                  <td className="td">
                    <div className="flex min-w-64 items-center gap-2">
                      <input
                        aria-label={`Exam date for ${subject.name}`}
                        className="input"
                        type="date"
                        value={scheduleDates[subject.examId] ?? ""}
                        onChange={(event) => setScheduleDates((current) => ({ ...current, [subject.examId]: event.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={scheduleUpdate.isPending || (scheduleDates[subject.examId] || "") === (subject.date ? new Date(subject.date).toISOString().slice(0, 10) : "")}
                        onClick={() => saveSchedule(subject.examId)}
                      >{scheduleUpdate.isPending ? "Saving…" : "Save"}</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            <Pagination page={studentPage} total={students.data?.total || 0} limit={25} onChange={(nextPage) => {
              setStudentPage(nextPage);
              setStudentId("");
            }} />
            <p className="px-4 pb-4 text-xs text-slate-500">Cards are generated with the latest saved student details and exam schedule. Updating a date changes the schedule for this subject.</p>
          </section>}

          {!classId && <div className="card text-sm text-slate-500">Select a class to manage and issue its admit cards.</div>}
          {classId && !groups.isLoading && !groups.isError && !adminGroups.length && <div className="card text-sm text-slate-500">No exam groups are available for this class yet.</div>}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.isLoading && <div className="card text-sm text-slate-500">Loading admit cards…</div>}
          {groups.isError && <div role="alert" className="card text-sm text-red-600">{groups.error.response?.data?.error || "Could not load admit cards."}</div>}
          {studentGroups.map((group) => (
            <section key={group._id} className="card p-0 overflow-x-auto">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <h2 className="text-lg font-semibold">{group.name}{group.term ? ` · ${group.term}` : ""}{group.year ? ` · ${group.year}` : ""}</h2>
                  <p className="text-sm text-slate-500">{group.class?.name} · Section {group.class?.section || "A"}</p>
                </div>
                <button type="button" className="btn-primary justify-center" onClick={() => issueCard(group, null)}>Download whole admit card</button>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="th">Subject</th><th className="th">Subject code</th><th className="th">Exam date</th></tr></thead>
                <tbody>{group.subjects.map((subject) => (
                  <tr key={subject.examId} className="border-t border-gray-100">
                    <td className="td">{subject.name}</td>
                    <td className="td">{subject.code || "—"}</td>
                    <td className="td">{displayDate(subject.date)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </section>
          ))}
          {!groups.isLoading && !groups.isError && !studentGroups.length && <div className="card text-center text-sm text-slate-500">No admit cards are available for your class yet.</div>}
        </div>
      )}
    </div>
  );
}
