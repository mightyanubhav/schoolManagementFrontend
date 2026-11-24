import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Modal, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const blank = { name: "", code: "", class: "" };

export default function Subjects() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api.get("/subjects").then(r => r.data) });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data) });

  const create = useMutation({
    mutationFn: (b) => api.post("/subjects", b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); setOpen(false); setForm(blank); },
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/subjects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });

  return (
    <div>
      <PageHeader title="Subjects" actions={canManage && <button className="btn-primary" onClick={() => setOpen(true)}>Add subject</button>} />
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="th">Code</th><th className="th">Name</th><th className="th">Class</th><th className="th">Teacher</th>{canManage && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {subjects.data?.map(s => (
              <tr key={s._id} className="border-t border-gray-100">
                <td className="td font-mono text-xs">{s.code}</td>
                <td className="td">{s.name}</td>
                <td className="td">{s.class ? `${s.class.name} · Section ${s.class.section || "A"}` : "—"}</td>
                <td className="td">{s.teacher?.user?.name || "—"}</td>
                {canManage && <td className="td"><button className="text-red-600 hover:underline" onClick={() => confirm("Delete?") && del.mutate(s._id)}>Delete</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New subject">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Code"><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></Field>
          <Field label="Class">
            <select className="input" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
              <option value="">—</option>
              {classes.data?.map(c => <option key={c._id} value={c._id}>{c.name} · Section {c.section || "A"}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}