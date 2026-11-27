import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Modal, Field } from "../components/ui";
import Pagination from "../components/Pagination";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

const blank = {
  name: "",
  fatherName: "",
  motherName: "",
  gender: "male",
  caste: "",
  dob: "",
  aadhaarNumber: "",
  address: "",
  class: "",
  rollNo: "",
  admissionNo: "",
  temporaryPassword: "",
  admissionDate: new Date().toISOString().slice(0, 10),
};

export default function Students() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [profileImage, setProfileImage] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [downloadingId, setDownloadingId] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [casteFilter, setCasteFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedSearch(search, () => setPage(1));

  const students = useQuery({
    queryKey: ["students", classFilter, sectionFilter, genderFilter, casteFilter, debouncedSearch, page],
    queryFn: async ({ signal }) => {
      const response = await api.get("/students", { params: {
      ...(classFilter && { class: classFilter }),
      ...(sectionFilter && { section: sectionFilter }),
      ...(genderFilter && { gender: genderFilter }),
      ...(casteFilter && { caste: casteFilter }),
      ...(debouncedSearch && { q: debouncedSearch }),
      page,
      limit: 25,
      }, signal });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data) });

  const create = useMutation({
    mutationFn: (body) => api.post("/students", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      setForm(blank);
      setProfileImage(null);
      setDocuments([]);
    },
  });
  const update = useMutation({
    mutationFn: (body) => api.put(`/students/${editing._id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/students/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });

  function openEdit(student) {
    setEditing(student);
    setForm({
      name: student.user?.name || "",
      fatherName: student.fatherName || "",
      motherName: student.motherName || "",
      gender: student.gender || "male",
      caste: student.caste || "",
      dob: student.dob?.slice(0, 10) || "",
      aadhaarNumber: student.aadhaarNumber || "",
      address: student.address || "",
      class: student.class?._id || "",
      rollNo: student.rollNo || "",
      admissionNo: student.admissionNo,
      temporaryPassword: "",
      admissionDate: student.admissionDate?.slice(0, 10) || "",
    });
    setOpen(true);
  }

  function submit(event) {
    event.preventDefault();
    if (editing) {
      const { temporaryPassword, ...body } = form;
      update.mutate(body);
      return;
    }
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (profileImage) body.append("profileImage", profileImage);
    documents.forEach((file) => body.append("documents", file));
    create.mutate(body);
  }

  async function downloadDocument(studentId, documentId) {
    const newWindow = window.open("about:blank", "_blank");
    try {
      const { data } = await api.get(`/students/${studentId}/documents/${documentId}/download`);
      if (newWindow) newWindow.location = data.url;
      else window.location.assign(data.url);
    } catch (error) {
      newWindow?.close();
      window.alert(error.response?.data?.error || "Could not open this document");
    }
  }

  async function downloadAdmissionProfile(student) {
    setDownloadingId(student._id);
    try {
      const response = await api.get(`/students/${student._id}/admission.pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admission-${student.admissionNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      window.alert(error.response?.data?.error || "Could not download student admission PDF");
    } finally {
      setDownloadingId("");
    }
  }

  const visibleStudents = students.data?.items || [];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`Showing ${visibleStudents.length} of ${students.data?.total ?? 0} enrolled`}
        actions={canManage && <button className="btn-primary" onClick={() => { setEditing(null); setForm(blank); setProfileImage(null); setDocuments([]); setOpen(true); }}>Add student</button>}
      />

      <div className="card mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Search"><input className="input w-full" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID or roll" /></Field>
        <Field label="Class"><select className="input" value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}><option value="">All classes</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>
        <Field label="Section"><input className="input" value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }} placeholder="All sections" /></Field>
        <Field label="Gender"><select className="input" value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}><option value="">All genders</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
        <Field label="Caste"><input className="input" value={casteFilter} onChange={(e) => { setCasteFilter(e.target.value); setPage(1); }} placeholder="All castes" /></Field>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Photo</th><th className="th">Student ID</th><th className="th">Name</th><th className="th">Parents</th><th className="th">Class</th><th className="th">Section</th><th className="th">Roll</th><th className="th">Gender</th>{canManage && <th className="th">Documents</th>}{canManage && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((student) => (
              <tr key={student._id} className="border-t border-gray-100">
                <td className="td">{student.profileImageUrl ? <img src={student.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{student.user?.name?.slice(0, 1) || "S"}</div>}</td>
                <td className="td font-mono text-xs">{student.admissionNo}</td>
                <td className="td">{student.user?.name}</td>
                <td className="td"><div>{student.fatherName || "—"}</div><div className="text-xs text-slate-500">{student.motherName || "—"}</div></td>
                <td className="td">{student.class?.name}</td>
                <td className="td">{student.class?.section || "—"}</td>
                <td className="td">{student.rollNo || "—"}</td>
                <td className="td capitalize">{student.gender || "—"}</td>
                {canManage && <td className="td">
                  {student.documents?.map((document) => <button key={document._id} type="button" className="block text-left text-brand-700 hover:underline" onClick={() => downloadDocument(student._id, document._id)}>{document.name}</button>)}
                  {!student.documents?.length && "—"}
                </td>}
                {canManage && <td className="td"><div className="flex flex-col items-start gap-1"><button type="button" className="text-brand-700 hover:underline" disabled={downloadingId === student._id} onClick={() => downloadAdmissionProfile(student)}>{downloadingId === student._id ? "Preparing PDF…" : "Download admission PDF"}</button><div><button className="mr-3 text-brand-600 hover:underline" onClick={() => openEdit(student)}>Edit</button><button className="text-red-600 hover:underline" onClick={() => confirm("Delete this student?") && del.mutate(student._id)}>Delete</button></div></div></td>}
              </tr>
            ))}
            {!visibleStudents.length && <tr><td className="td text-center text-slate-500" colSpan={canManage ? 10 : 8}>No students found</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={students.data?.total || 0} limit={25} onChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit student" : "Add student"}>
        <form onSubmit={submit} className="space-y-3">
          {create.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{create.error.response?.data?.error || "Could not add student"}</div>}
          {update.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{update.error.response?.data?.error || "Could not update student"}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Student name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Student ID"><input className="input" value={form.admissionNo} onChange={(e) => setForm({ ...form, admissionNo: e.target.value })} required /></Field>
            <Field label="Father's name"><input className="input" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} /></Field>
            <Field label="Mother's name"><input className="input" value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} /></Field>
            <Field label="Gender"><select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
            <Field label="Caste"><input className="input" value={form.caste} onChange={(e) => setForm({ ...form, caste: e.target.value })} /></Field>
            <Field label="Date of birth"><input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
            <Field label="Admission date"><input className="input" type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} /></Field>
            <Field label="Aadhaar number"><input className="input" inputMode="numeric" maxLength="12" pattern="[0-9]{12}" value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Roll number"><input className="input" value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} /></Field>
            <Field label="Class"><select className="input" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} required><option value="">Select class</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>
            {!editing && <Field label="Temporary password"><PasswordInput className="input" minLength="8" autoComplete="new-password" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} required /><span className="mt-1 block text-xs text-slate-500">Share this password securely; the student must change it after first login.</span></Field>}
            {!editing && <Field label="Student photograph"><input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file && file.size > 300 * 1024) { e.target.value = ""; window.alert("Student photograph must be 300 KB or smaller"); setProfileImage(null); } else setProfileImage(file || null); }} /><span className="mt-1 block text-xs text-slate-500">PNG, JPG or WebP; maximum 300 KB.</span></Field>}
            {!editing && <Field label="Documents"><input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" multiple onChange={(e) => setDocuments(Array.from(e.target.files || []))} /><span className="mt-1 block text-xs text-slate-500">PDF, Word or images; up to 10 files.</span></Field>}
            <Field label="Address"><textarea className="input min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending || update.isPending}>{editing ? "Save" : "Create student"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
