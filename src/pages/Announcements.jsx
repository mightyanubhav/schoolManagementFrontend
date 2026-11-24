import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Modal, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import Pagination from "../components/Pagination";

export default function Announcements() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all", class: "" });
  const [page, setPage] = useState(1);

  const anns = useQuery({
    queryKey: ["announcements", page],
    queryFn: async () => {
      const response = await api.get("/announcements", { params: { page, limit: 20 } });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data), enabled: ["admin", "teacher"].includes(user?.role) });
  const create = useMutation({
    mutationFn: (body) => {
      const { audience, class: classId, ...rest } = body;
      return api.post("/announcements", audience === "class"
        ? { ...rest, audience: "students", class: classId }
        : { ...rest, audience });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); setOpen(false); setForm({ title: "", body: "", audience: "all", class: "" }); },
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const canPost = ["admin", "teacher"].includes(user?.role);

  return (
    <div>
      <PageHeader
        title="Announcements"
        actions={canPost && <button className="btn-primary" onClick={() => setOpen(true)}>New</button>}
      />
      <div className="space-y-3">
        {anns.data?.items?.map(a => (
          <div key={a._id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 break-words font-semibold text-slate-900">{a.title}</div>
              {user?.role === "admin" && <button className="shrink-0 text-sm text-red-600 hover:underline" onClick={() => confirm("Delete?") && del.mutate(a._id)}>Delete</button>}
            </div>
            <div className="mt-2 break-words text-sm leading-6 text-slate-600">{a.body}</div>
            <div className="text-xs text-gray-500 mt-2">{a.class ? `Students · ${a.class.name} · Section ${a.class.section || "A"}` : `${a.audience === "all" ? "All school" : a.audience} · ${a.postedBy?.name}`}</div>
          </div>
        ))}
        {!anns.data?.items?.length && <div className="text-sm text-gray-500">No announcements yet.</div>}
      </div>
      <Pagination page={page} total={anns.data?.total || 0} limit={20} onChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title="New announcement">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-3">
          <Field label="Title"><input className="input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="Body"><textarea className="input" rows={4} maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></Field>
          <Field label="Audience">
            <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">All school</option>
              <option value="students">Students</option>
              <option value="class">Specific class students</option>
              <option value="parents">Parents</option>
              <option value="teachers">Teachers</option>
              <option value="staff">Staff</option>
            </select>
          </Field>
          {form.audience === "class" && <Field label="Class"><select className="input" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} required><option value="">Select class</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending}>{create.isPending ? "Posting…" : "Post"}</button>
          </div>
          {create.isError && <p role="alert" className="text-sm text-red-600">{create.error.response?.data?.error || "Could not post announcement"}</p>}
        </form>
      </Modal>
    </div>
  );
}