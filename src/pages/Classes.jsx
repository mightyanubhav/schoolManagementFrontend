import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Modal, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const blank = { name: "", grade: 1, section: "A", room: "" };

export default function Classes() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then(r => r.data) });
  const create = useMutation({
    mutationFn: (b) => api.post("/classes", b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); setOpen(false); setForm(blank); },
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/classes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });

  return (
    <div>
      <PageHeader title="Classes" actions={canManage && <button className="btn-primary" onClick={() => setOpen(true)}>Add class</button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {classes.data?.map(c => (
          <div key={c._id} className="card">
            <div className="text-lg font-semibold">{c.name}</div>
            <div className="text-sm text-gray-500">Grade {c.grade} · Section {c.section}</div>
            <div className="text-sm text-gray-500">Room {c.room || "—"}</div>
            {canManage && <button className="mt-3 text-sm text-red-600 hover:underline" onClick={() => confirm("Delete?") && del.mutate(c._id)}>Delete</button>}
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New class">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grade"><input className="input" type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })} /></Field>
            <Field label="Section"><input className="input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Field>
          </div>
          <Field label="Room"><input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}