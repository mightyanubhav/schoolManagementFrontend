import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Modal, Field } from "../components/ui";
import Pagination from "../components/Pagination";
import PasswordInput from "../components/PasswordInput";

const blank = {
  name: "",
  email: "",
  phone: "",
  subjects: [],
  classes: [],
  gender: "male",
  joinDate: new Date().toISOString().slice(0, 10),
  qualification: "",
  temporaryPassword: "",
};

function assignmentIds(items) {
  return items?.map((item) => typeof item === "string" ? item : item._id) || [];
}

export default function Teachers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [profileImage, setProfileImage] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [page, setPage] = useState(1);

  const teachers = useQuery({
    queryKey: ["teachers", page],
    queryFn: async () => {
      const response = await api.get("/teachers", { params: { page, limit: 25 } });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data) });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api.get("/subjects").then(r => r.data) });

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
    setProfileImage(null);
    setDocuments([]);
  }

  const create = useMutation({
    mutationFn: (body) => api.post("/teachers", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); closeForm(); },
  });
  const update = useMutation({
    mutationFn: (body) => api.put(`/teachers/${editing._id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); closeForm(); },
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/teachers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  function startCreate() {
    setEditing(null);
    setForm({ ...blank, joinDate: new Date().toISOString().slice(0, 10) });
    setProfileImage(null);
    setDocuments([]);
    create.reset();
    update.reset();
    setOpen(true);
  }

  function startEdit(teacher) {
    setEditing(teacher);
    setForm({
      name: teacher.user?.name || "",
      email: teacher.user?.email || "",
      phone: teacher.user?.phone || "",
      subjects: assignmentIds(teacher.subjects),
      classes: assignmentIds(teacher.classes),
      gender: teacher.gender || "male",
      joinDate: teacher.joinDate ? teacher.joinDate.slice(0, 10) : "",
      qualification: teacher.qualification || "",
      temporaryPassword: "",
    });
    setProfileImage(null);
    setDocuments([]);
    create.reset();
    update.reset();
    setOpen(true);
  }

  function submit(event) {
    event.preventDefault();
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "subjects" || key === "classes") body.append(key, JSON.stringify(value));
      else if (key !== "temporaryPassword" || value) body.append(key, value);
    });
    if (profileImage) body.append("profileImage", profileImage);
    documents.forEach((file) => body.append("documents", file));
    if (editing) update.mutate(body); else create.mutate(body);
  }

  async function downloadDocument(teacherId, documentId) {
    const newWindow = window.open("about:blank", "_blank");
    try {
      const { data } = await api.get(`/teachers/${teacherId}/documents/${documentId}/download`);
      if (newWindow) newWindow.location = data.url;
      else window.location.assign(data.url);
    } catch (error) {
      newWindow?.close();
      window.alert(error.response?.data?.error || "Could not open this document");
    }
  }

  function toggleClass(classId) {
    const nextClasses = form.classes.includes(classId)
      ? form.classes.filter((id) => id !== classId)
      : [...form.classes, classId];
    const validSubjectIds = subjects.data?.filter((subject) =>
      !subject.class || nextClasses.includes(subject.class._id)
    ).map((subject) => subject._id) || [];
    setForm({
      ...form,
      classes: nextClasses,
      subjects: form.subjects.filter((id) => validSubjectIds.includes(id)),
    });
  }

  function toggleSubject(subjectId) {
    setForm({
      ...form,
      subjects: form.subjects.includes(subjectId)
        ? form.subjects.filter((id) => id !== subjectId)
        : [...form.subjects, subjectId],
    });
  }

  const availableSubjects = subjects.data?.filter((subject) =>
    (!subject.teacher || (editing && subject.teacher._id === editing._id)) &&
    (!subject.class || form.classes.includes(subject.class._id))
  ) || [];
  const mutation = editing ? update : create;

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle={`${teachers.data?.total ?? 0} on staff`}
        actions={<button className="btn-primary" onClick={startCreate}>Add teacher</button>}
      />
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="th">Profile</th><th className="th">Employee</th><th className="th">Name / Email</th><th className="th">Mobile</th><th className="th">Subject(s)</th><th className="th">Class(es)</th><th className="th">Gender</th><th className="th">Joining date</th><th className="th">Documents</th><th className="th">Actions</th>
          </tr></thead>
          <tbody>
            {teachers.data?.items?.map((teacher) => (
              <tr key={teacher._id} className="border-t border-gray-100">
                <td className="td">
                  {teacher.profileImageUrl
                    ? <img src={teacher.profileImageUrl} alt={`${teacher.user?.name || "Teacher"} profile`} className="h-10 w-10 rounded-full object-cover" />
                    : <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{teacher.user?.name?.slice(0, 1) || "T"}</div>}
                </td>
                <td className="td font-mono text-xs">{teacher.employeeId}</td>
                <td className="td"><div className="font-medium text-slate-900">{teacher.user?.name}</div><div className="mt-0.5 text-xs text-slate-500">{teacher.user?.email}</div></td>
                <td className="td">{teacher.user?.phone || "—"}</td>
                <td className="td">{teacher.subjects?.map((subject) => subject.name).join(", ") || "—"}</td>
                <td className="td">{teacher.classes?.map((schoolClass) => `${schoolClass.name} · Section ${schoolClass.section || "A"}`).join(", ") || "—"}</td>
                <td className="td capitalize">{teacher.gender || "—"}</td>
                <td className="td">{teacher.joinDate ? new Date(teacher.joinDate).toLocaleDateString() : "—"}</td>
                <td className="td">
                  <div className="flex flex-col items-start gap-1">
                    {teacher.documents?.map((document) => <button key={document._id} type="button" className="text-left text-brand-700 hover:underline" onClick={() => downloadDocument(teacher._id, document._id)}>{document.name}</button>)}
                    {!teacher.documents?.length && <span className="text-slate-400">—</span>}
                  </div>
                  <Pagination page={page} total={teachers.data?.total || 0} limit={25} onChange={setPage} />
                </td>
                <td className="td whitespace-nowrap"><button className="mr-3 text-brand-600 hover:underline" onClick={() => startEdit(teacher)}>Edit</button><button className="text-red-600 hover:underline" onClick={() => confirm("Delete?") && del.mutate(teacher._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={closeForm} title={editing ? "Edit teacher" : "Add teacher"}>
        <form onSubmit={submit} className="space-y-4">
          {mutation.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutation.error.response?.data?.error || `Could not ${editing ? "update" : "create"} teacher account`}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required /></Field>
            <Field label="Mobile number"><input className="input" type="tel" inputMode="tel" pattern="[+]?[0-9]{7,15}" title="Enter 7 to 15 digits, optionally prefixed with +" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" maxLength={16} required /></Field>
            <Field label={editing ? "Reset password (optional)" : "Temporary password"}><PasswordInput className="input" value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} autoComplete="new-password" minLength={form.temporaryPassword ? 8 : undefined} required={!editing} /><span className="mt-1 block text-xs text-slate-500">{editing ? "If set, the teacher must change it at next login." : "Teacher will be asked to change it after first login."}</span></Field>
            <Field label="Gender"><select className="input" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} required><option value="male">Male</option><option value="female">Female</option></select></Field>
            <Field label="Date of joining"><input className="input" type="date" value={form.joinDate} onChange={(event) => setForm({ ...form, joinDate: event.target.value })} required /></Field>
            <Field label="Qualification"><input className="input" value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} placeholder="e.g. M.Ed" /></Field>
            {editing?.profileImageUrl && <div className="flex items-center gap-3"><img src={editing.profileImageUrl} alt="Current teacher profile" className="h-12 w-12 rounded-full object-cover" /><span className="text-sm text-slate-500">Current profile photo</span></div>}
            <Field label="Profile image"><input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setProfileImage(event.target.files?.[0] || null)} /><span className="mt-1 block text-xs text-slate-500">PNG, JPG, or WebP; up to 5 MB.</span></Field>
            <Field label="Documents"><input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" multiple onChange={(event) => setDocuments(Array.from(event.target.files || []))} /><span className="mt-1 block text-xs text-slate-500">PDF, Word, or images; up to 10 files, 5 MB each.</span></Field>
          </div>

          <Field label="Classes (select all that apply)">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3">
              {classes.data?.map((schoolClass) => <label key={schoolClass._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.classes.includes(schoolClass._id)} onChange={() => toggleClass(schoolClass._id)} />{schoolClass.name} · Section {schoolClass.section || "A"}</label>)}
              {!classes.data?.length && <span className="text-sm text-slate-500">Create classes first.</span>}
            </div>
          </Field>
          <Field label="Subjects (select all that apply)">
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              {availableSubjects.map((subject) => <label key={subject._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.subjects.includes(subject._id)} onChange={() => toggleSubject(subject._id)} />{subject.name}{subject.code ? ` (${subject.code})` : ""}{subject.class?.name ? <span className="text-xs text-slate-500">· {subject.class.name}{subject.class.section ? ` · Section ${subject.class.section}` : ""}</span> : null}</label>)}
              {!availableSubjects.length && <span className="text-sm text-slate-500">Select classes with subjects first.</span>}
            </div>
          </Field>
          <p className="text-xs leading-5 text-slate-500">The teacher can be assigned multiple classes and subjects. Subjects associated with a class are selectable only when that class is selected.</p>
          <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
            <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
            <button className="btn-primary justify-center" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : editing ? "Save teacher details" : "Create teacher"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
