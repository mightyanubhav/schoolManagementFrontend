import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Modal, Field } from "../components/ui";
import Pagination from "../components/Pagination";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

const now = new Date();
const blank = {
  teacher: "",
  month: String(now.getMonth() + 1),
  year: String(now.getFullYear()),
  amount: "",
  paidAmount: "",
  status: "due",
  remarks: "",
};

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function Salary() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedSearch(search, () => setPage(1));

  const salaries = useQuery({
    queryKey: ["salaries", monthFilter, statusFilter, debouncedSearch, page],
    queryFn: async ({ signal }) => {
      const response = await api.get("/salaries", { params: {
        ...(monthFilter && { month: monthFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(debouncedSearch && { q: debouncedSearch }),
        page,
        limit: 25,
      }, signal });
      return {
        items: response.data,
        total: Number(response.headers["x-total-count"] || 0),
        totalAmount: Number(response.headers["x-total-amount"] || 0),
        totalPaid: Number(response.headers["x-total-paid"] || 0),
      };
    },
  });
  const teachers = useQuery({ queryKey: ["salary-teachers"], queryFn: () => api.get("/teachers", { params: { limit: 100 } }).then(r => r.data) });

  const save = useMutation({
    mutationFn: (body) => editing ? api.put(`/salaries/${editing._id}`, body) : api.post("/salaries", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salaries"] });
      setOpen(false);
      setEditing(null);
      setForm(blank);
    },
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/salaries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });

  function openEdit(salary) {
    setEditing(salary);
    setForm({
      teacher: salary.teacher?._id || "",
      month: String(salary.month),
      year: String(salary.year),
      amount: String(salary.amount),
      paidAmount: String(salary.paidAmount || 0),
      status: salary.status,
      remarks: salary.remarks || "",
    });
    setOpen(true);
  }

  function submit(event) {
    event.preventDefault();
    const paidAmount = form.status === "due" ? 0 : form.status === "paid" ? Number(form.amount) : Number(form.paidAmount || 0);
    save.mutate({ ...form, amount: Number(form.amount), paidAmount, year: Number(form.year), month: Number(form.month) });
  }

  const visible = salaries.data?.items || [];
  const total = salaries.data?.totalAmount || 0;
  const paid = salaries.data?.totalPaid || 0;

  return (
    <div>
      <PageHeader
        title="Salary"
        subtitle={`Salary ${money(total)} · Paid ${money(paid)}`}
        actions={<button className="btn-primary" onClick={() => { setEditing(null); setForm(blank); save.reset(); setOpen(true); }}>Add salary</button>}
      />

      <div className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Search</label>
          <input className="input w-full" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Teacher name or employee ID" />
        </div>
        <div>
          <label className="label">Month</label>
          <select className="input" value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}>
            <option value="">All months</option>{months.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="due">Due</option>
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="th">Teacher</th><th className="th">Employee</th><th className="th">Month</th><th className="th">Amount</th><th className="th">Paid</th><th className="th">Status</th><th className="th">Actions</th>
          </tr></thead>
          <tbody>
            {visible.map((salary) => (
              <tr key={salary._id} className="border-t border-gray-100">
                <td className="td">{salary.teacher?.user?.name || "—"}</td>
                <td className="td font-mono text-xs">{salary.teacher?.employeeId || "—"}</td>
                <td className="td">{months[salary.month - 1]} {salary.year}</td>
                <td className="td">{money(salary.amount)}</td>
                <td className="td">{money(salary.paidAmount)}</td>
                <td className="td">
                  <span className={`rounded px-2 py-0.5 text-xs ${salary.status === "paid" ? "bg-green-100 text-green-700" : salary.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{salary.status}</span>
                </td>
                <td className="td">
                  <button className="mr-3 text-brand-600 hover:underline" onClick={() => openEdit(salary)}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => confirm("Delete this salary record?") && del.mutate(salary._id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!visible.length && <tr><td className="td text-center text-slate-500" colSpan="7">No salary records found</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={salaries.data?.total || 0} limit={25} onChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit salary" : "Add salary"}>
        <form onSubmit={submit} className="space-y-3">
          {save.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{save.error.response?.data?.error || "Could not save salary"}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Teacher"><select className="input" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} required><option value="">Select teacher</option>{teachers.data?.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.user?.name} ({teacher.employeeId})</option>)}</select></Field>
            <Field label="Month"><select className="input" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} required>{months.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}</select></Field>
            <Field label="Year"><input className="input" type="number" min="2000" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required /></Field>
            <Field label="Salary amount"><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">₹</span><input className="input w-full pl-8" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div></Field>
            <Field label="Payment status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value, paidAmount: e.target.value === "paid" ? form.amount : e.target.value === "due" ? "0" : form.paidAmount })} required><option value="paid">Paid</option><option value="partial">Partial</option><option value="due">Due</option></select></Field>
            {form.status === "partial" && <Field label="Paid amount"><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">₹</span><input className="input w-full pl-8" type="number" min="0" max={form.amount || undefined} step="0.01" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} required /></div></Field>}
          </div>
          <Field label="Remarks"><textarea className="input min-h-20" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary justify-center" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save salary" : "Create salary"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
