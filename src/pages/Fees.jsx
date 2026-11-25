import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import Pagination from "../components/Pagination";

const feeFields = [
  ["admissionFee", "Admission Fee"],
  ["securityDeposit", "Security Deposit"],
  ["schoolFee", "School Fee"],
  ["registrationFee", "Registration Fee"],
  ["examinationFee", "Examination Fee"],
  ["computerEducationFee", "Computer Education Fee"],
  ["tieBelt", "Tie + Belt"],
  ["idCard", "ID Card"],
  ["schoolDiary", "School Diary"],
  ["classPicnic", "Class Picnic"],
  ["schoolTrip", "School Trip"],
  ["lateFee", "Late Fee"],
  ["shoesSocks", "Shoes + Socks"],
  ["books", "Books"],
  ["dressFee", "Dress Fee"],
  ["monthlyFee", "Monthly Fee"],
];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const emptyStructure = Object.fromEntries(feeFields.map(([key]) => [key, ""]));
const currentDate = new Date();
const currentAcademicYear = currentDate.getMonth() >= 3 ? currentDate.getFullYear() : currentDate.getFullYear() - 1;
const academicMonths = Array.from({ length: 12 }, (_, index) => {
  const month = (index + 3) % 12 + 1;
  return { month, year: currentAcademicYear + (month < 4 ? 1 : 0) };
});

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function statusFor(total, paid) {
  if (paid >= total) return "Paid";
  if (paid > 0) return "Partial";
  return "Due";
}

export default function Fees() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminFees />;
  if (user?.role === "student") return <StudentFees />;

  const [page, setPage] = useState(1);
  const fees = useQuery({
    queryKey: ["fees", page],
    queryFn: async () => {
      const response = await api.get("/fees", { params: { page, limit: 25 } });
      return {
        items: response.data,
        total: Number(response.headers["x-total-count"] || 0),
        totalAmount: Number(response.headers["x-total-amount"] || 0),
        pending: Number(response.headers["x-total-pending"] || 0),
      };
    },
  });
  const total = fees.data?.totalAmount || 0;
  const paid = Math.max(0, total - (fees.data?.pending || 0));

  return (
    <div>
      <PageHeader title="Fees" subtitle={`Paid ${money(paid)} of ${money(total)}`} />
      {fees.isLoading && <div className="card mb-4 text-sm text-slate-500">Loading fee records…</div>}
      {fees.isError && <p role="alert" className="mb-4 text-sm text-red-600">{fees.error.response?.data?.error || "Could not load fee records"}</p>}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="th">Student</th><th className="th">Title</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Due</th></tr></thead>
          <tbody>
            {fees.data?.items?.map((fee) => (
              <tr key={fee._id} className="border-t border-gray-100">
                <td className="td">{fee.student?.user?.name}</td><td className="td">{fee.title}</td><td className="td">{money(fee.amount)}</td>
                <td className="td"><span className={`rounded px-2 py-0.5 text-xs ${fee.status === "paid" ? "bg-green-100 text-green-700" : fee.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{fee.status}</span></td>
                <td className="td">{fee.dueDate?.slice(0, 10) || "—"}</td>
              </tr>
            ))}
            {!fees.isLoading && !fees.isError && !fees.data?.items?.length && <tr><td className="td text-center text-slate-500" colSpan="5">No fees found</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={fees.data?.total || 0} limit={25} onChange={setPage} />
    </div>
  );
}

function StudentFees() {
  const [page, setPage] = useState(1);
  const fees = useQuery({
    queryKey: ["my-fees", page],
    queryFn: async () => {
      const response = await api.get("/fees/me", { params: { page, limit: 25 } });
      return {
        ...response.data,
        paymentPage: { total: Number(response.headers["x-total-count"] || 0) },
      };
    },
  });
  const data = fees.data;
  const totals = data?.totals || { total: 0, paid: 0, due: 0 };
  const upcoming = data?.monthlyDues?.filter((item) => item.state === "upcoming" && item.dueAmount > 0) || [];
  const outstanding = data?.monthlyDues?.filter((item) => ["overdue", "due"].includes(item.state) && item.dueAmount > 0) || [];
  const legacyDue = data?.legacyFees?.filter((fee) => fee.status !== "paid") || [];

  return (
    <div>
      <PageHeader
        title="My Fees"
        subtitle={data ? `${data.student.user?.name} · Class ${data.student.class?.name || "—"} · Section ${data.student.class?.section || "A"} · Roll ${data.student.rollNo || "—"}` : "Your fee summary, dues, and payment history"}
      />
      {fees.isLoading && <div className="card text-sm text-slate-500">Loading fee information…</div>}
      {fees.isError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{fees.error.response?.data?.error || "Could not load your fee information"}</div>}
      {data && <>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FeeMetric label={`Academic year ${data.academicYear}–${data.academicYear + 1} total`} value={totals.total} />
          <FeeMetric label="Total paid" value={totals.paid} color="text-green-700" />
          <FeeMetric label="Outstanding dues" value={totals.due} color="text-amber-700" />
        </div>

        {data.structure && <section className="card mb-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-lg font-semibold">One-time fee structure</h2><p className="text-xs text-slate-500">Fee amounts and payments recorded by the school.</p></div>
            <span className="text-sm font-semibold">Total {money(data.structure.oneTimeTotal)} · Paid {money(data.structure.oneTimePaid)} · Due {money(data.structure.oneTimeDue)}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.structure.items.map((item) => <div key={item.name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{item.name}</span><strong>{money(item.amount)}</strong></div>)}
          </div>
        </section>}

        <section className="card mb-4 p-0 overflow-x-auto">
          <div className="p-4"><h2 className="font-semibold">Monthly fee · {data.academicYear}–{data.academicYear + 1}</h2><p className="text-xs text-slate-500">Outstanding months are shown as due; future months are upcoming. Ask the school office for exact payment deadlines.</p></div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="th">Month</th><th className="th">Monthly fee</th><th className="th">Paid</th><th className="th">Due</th><th className="th">Status</th></tr></thead>
            <tbody>{data.monthlyDues.map((item) => <tr key={`${item.year}-${item.month}`} className="border-t border-gray-100"><td className="td">{monthNames[item.month - 1]} {item.year}</td><td className="td">{money(item.totalFee)}</td><td className="td">{money(item.paidAmount)}</td><td className="td">{money(item.dueAmount)}</td><td className="td"><span className={`rounded px-2 py-0.5 text-xs capitalize ${item.state === "paid" ? "bg-green-100 text-green-700" : item.state === "upcoming" ? "bg-blue-100 text-blue-700" : item.state === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{item.state}</span></td></tr>)}
              {!data.monthlyDues.length && <tr><td className="td text-center text-slate-500" colSpan="5">No monthly fee is configured.</td></tr>}
            </tbody>
          </table>
        </section>

        {(outstanding.length > 0 || upcoming.length > 0 || legacyDue.length > 0) && <section className="card mb-4">
          <h2 className="mb-3 text-lg font-semibold">Upcoming and outstanding dues</h2>
          {data.structure?.oneTimeDue > 0 && <div className="mb-2 flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm"><span>Outstanding one-time fees</span><strong>{money(data.structure.oneTimeDue)}</strong></div>}
          {[...outstanding, ...upcoming].map((item) => <div key={`due-${item.year}-${item.month}`} className="mb-2 flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm"><span>{monthNames[item.month - 1]} {item.year} monthly fee {item.state === "upcoming" ? "(upcoming)" : "(due)"}</span><strong>{money(item.dueAmount)}</strong></div>)}
          {legacyDue.map((fee) => <div key={fee._id} className="mb-2 flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm"><span>{fee.label} {fee.dueDate ? `(due ${new Date(fee.dueDate).toLocaleDateString("en-IN")})` : "(due date not set)"}</span><strong>{money(fee.amount)} · {fee.status}</strong></div>)}
        </section>}

        <section className="card mb-4 p-0 overflow-x-auto">
          <div className="p-4"><h2 className="font-semibold">Payment history</h2></div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Type</th><th className="th">Month</th><th className="th">Total</th><th className="th">Paid</th><th className="th">Remaining</th><th className="th">Receipt</th></tr></thead>
            <tbody>{data.payments.map((payment) => <tr key={payment._id} className="border-t border-gray-100"><td className="td">{new Date(payment.paidAt).toLocaleDateString("en-IN")}</td><td className="td">{payment.type === "monthly" ? "Monthly fee" : "One-time fee"}</td><td className="td">{payment.month ? `${monthNames[payment.month - 1]} ${payment.year}` : "—"}</td><td className="td">{money(payment.totalFee)}</td><td className="td">{money(payment.paidAmount)}</td><td className="td">{money(payment.dueAmount)}</td><td className="td font-mono text-xs">{payment.receiptNo}</td></tr>)}
              {!data.payments.length && <tr><td className="td text-center text-slate-500" colSpan="7">No payments have been recorded yet.</td></tr>}
            </tbody>
          </table>
        </section>
        <Pagination page={page} total={data.paymentPage.total} limit={25} onChange={setPage} />

        {data.legacyFees.length > 0 && <section className="card p-0 overflow-x-auto">
          <div className="p-4"><h2 className="font-semibold">Other fee records</h2><p className="text-xs text-slate-500">Earlier fee records are shown separately from the current fee structure.</p></div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="th">Fee</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Due date</th></tr></thead>
            <tbody>{data.legacyFees.map((fee) => <tr key={fee._id} className="border-t border-gray-100"><td className="td">{fee.label}</td><td className="td">{money(fee.amount)}</td><td className="td capitalize">{fee.status}</td><td className="td">{fee.dueDate ? new Date(fee.dueDate).toLocaleDateString("en-IN") : "—"}</td></tr>)}</tbody>
          </table>
        </section>}
      </>}
    </div>
  );
}

function FeeMetric({ label, value, color = "text-slate-900" }) {
  return <div className="card"><span className="block text-xs text-slate-500">{label}</span><strong className={`mt-1 block text-2xl ${color}`}>{money(value)}</strong></div>;
}

function AdminFees() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("payment");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [structureForm, setStructureForm] = useState(emptyStructure);
  const [paymentType, setPaymentType] = useState("one-time");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(`${currentDate.getMonth() + 1}`);
  const [year, setYear] = useState(`${currentDate.getMonth() >= 3 ? currentDate.getFullYear() : currentDate.getFullYear() - 1}`);
  const [remarks, setRemarks] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [reportMonth, setReportMonth] = useState("");
  const [reportYear, setReportYear] = useState(`${currentAcademicYear}`);
  const [reportSearch, setReportSearch] = useState("");
  const [reportPage, setReportPage] = useState(1);

  const students = useQuery({
    queryKey: ["fee-students", studentSearch, studentPage],
    queryFn: async () => {
      const response = await api.get("/fees/students", { params: {
        ...(studentSearch && { q: studentSearch }),
        page: studentPage,
        limit: 25,
      } });
      return { items: response.data, total: Number(response.headers["x-total-count"] || 0) };
    },
  });
  const management = useQuery({
    queryKey: ["fee-management", studentId, paymentPage],
    queryFn: async () => {
      const response = await api.get(`/fees/management/${studentId}`, { params: { page: paymentPage, limit: 25 } });
      return {
        ...response.data,
        paymentPage: { total: Number(response.headers["x-total-count"] || 0) },
      };
    },
    enabled: !!studentId,
  });
  const report = useQuery({
    queryKey: ["fee-report", reportMonth, reportYear, reportSearch, reportPage],
    queryFn: async () => {
      const response = await api.get("/fees/report", { params: {
      year: reportYear,
      ...(reportMonth && { month: reportMonth }),
      ...(reportSearch && { q: reportSearch }),
      page: reportPage,
      limit: 25,
      } });
      return {
        ...response.data,
        pageTotal: Number(response.headers["x-total-count"] || 0),
      };
    },
    enabled: tab === "report",
  });

  useEffect(() => {
    if (management.data) {
      const current = management.data.structure || {};
      setStructureForm(Object.fromEntries(feeFields.map(([key]) => [key, current[key] == null ? "" : String(current[key])])));
    }
  }, [management.data]);

  const saveStructure = useMutation({
    mutationFn: (body) => api.put(`/fees/structure/${studentId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-management", studentId] }),
  });
  const savePayment = useMutation({
    mutationFn: (body) => api.post("/fees/payments", body),
    onSuccess: ({ data }) => {
      setReceipt({ payment: data, student: management.data.student });
      setAmount("");
      setRemarks("");
      qc.invalidateQueries({ queryKey: ["fee-management", studentId] });
      qc.invalidateQueries({ queryKey: ["fee-report"] });
    },
  });

  const selectedStudent = management.data?.student;
  const oneTimeTotal = management.data?.oneTimeTotal || 0;
  const oneTimePaid = management.data?.paymentSummary?.oneTimePaid || 0;
  const monthlyFee = management.data?.structure?.monthlyFee || 0;
  const monthlyPaid = management.data?.paymentSummary?.monthlyByPeriod
    ?.find((payment) => payment.month === Number(month) && payment.year === Number(year))?.paidAmount || 0;
  const paymentHistory = management.data?.payments || [];
  const monthlyHistoryTotal = monthlyFee * (management.data?.paymentSummary?.monthlyPeriodCount || 0);
  const monthlyHistoryPaid = management.data?.paymentSummary?.monthlyPaid || 0;
  const monthlyPaidByPeriod = new Map((management.data?.paymentSummary?.monthlyByPeriod || [])
    .map((payment) => [`${payment.month}-${payment.year}`, payment.paidAmount]));
  const due = paymentType === "one-time"
    ? Math.max(0, oneTimeTotal - oneTimePaid)
    : Math.max(0, monthlyFee - monthlyPaid);
  const reportRows = report.data?.rows || [];

  const reportSummary = useMemo(() => report.data?.totals || { totalFee: 0, paidAmount: 0, dueAmount: 0 }, [report.data]);

  function changeStudent(value) {
    setStudentId(value);
    setPaymentPage(1);
    setReceipt(null);
    savePayment.reset();
    saveStructure.reset();
  }

  function saveFeeStructure(event) {
    event.preventDefault();
    saveStructure.mutate(Object.fromEntries(feeFields.map(([key]) => [key, Number(structureForm[key] || 0)])));
  }

  function calculatePayment(event) {
    event.preventDefault();
    if (!studentId || !due || Number(amount) <= 0) return;
    savePayment.mutate({
      student: studentId,
      type: paymentType,
      ...(paymentType === "monthly" && { month: Number(month), year: Number(year) }),
      paidAmount: Number(amount),
      remarks,
    });
  }

  const allMonthsForAcademicYear = (academicYear) => Array.from({ length: 12 }, (_, index) => {
    const monthNumber = (index + 3) % 12 + 1;
    return { month: monthNumber, year: Number(academicYear) + (monthNumber < 4 ? 1 : 0) };
  });

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden !important; } .fee-receipt, .fee-receipt * { visibility: visible !important; } .fee-receipt { position: absolute; inset: 0 auto auto 0; width: 100%; } .fee-receipt-actions { display: none !important; } }`}</style>
      <PageHeader title="Fee Payment" subtitle="Manage fee structures, receive payments, and view payment reports" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["payment", "Collect payment"], ["structure", "Fee structure"], ["history", "Payment history"], ["report", "Payment report"]].map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? "btn-primary" : "btn-ghost"} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>

      {tab !== "report" && (
        <div className="card mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(16rem,2fr)]">
          <Field label="Search student"><input className="input w-full" maxLength={100} value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setStudentPage(1); }} placeholder="Name, student ID, or roll number" /></Field>
          <Field label="Select student"><select className="input w-full" value={studentId} onChange={(event) => changeStudent(event.target.value)}><option value="">Select a student</option>{students.data?.items?.map((student) => <option key={student._id} value={student._id}>{student.user?.name} · Roll {student.rollNo || "—"} · ID {student.admissionNo}</option>)}</select></Field>
        </div>
      )}
      {tab !== "report" && <Pagination page={studentPage} total={students.data?.total || 0} limit={25} onChange={setStudentPage} />}

      {tab !== "report" && students.isLoading && <div className="card text-sm text-slate-500">Loading students…</div>}
      {tab !== "report" && students.isError && <p role="alert" className="text-sm text-red-600">{students.error.response?.data?.error || "Could not load students"}</p>}
      {tab !== "report" && !studentId && <div className="card text-sm text-slate-500">Search and select a student to manage their fee structure and payments.</div>}
      {management.isLoading && studentId && <div className="card text-sm text-slate-500">Loading student fee details…</div>}
      {management.isError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{management.error.response?.data?.error || "Could not load student fee details"}</div>}

      {tab === "structure" && studentId && management.data && (
        <form className="card" onSubmit={saveFeeStructure}>
          <h2 className="mb-1 text-lg font-semibold">Fee structure · {selectedStudent.user?.name}</h2>
          <p className="mb-4 text-sm text-slate-500">Set one-time fee amounts and the recurring monthly fee.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {feeFields.map(([key, label]) => (
              <Field key={key} label={label}>
                <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">₹</span><input className="input w-full pl-8" type="number" min="0" step="0.01" value={structureForm[key]} onChange={(event) => setStructureForm({ ...structureForm, [key]: event.target.value })} /></div>
              </Field>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">One-time total: {money(feeFields.slice(0, -1).reduce((sum, [key]) => sum + Number(structureForm[key] || 0), 0))} <span className="ml-3 text-sm font-normal text-slate-500">Monthly: {money(structureForm.monthlyFee)}</span></p>
            <button className="btn-primary justify-center" disabled={saveStructure.isPending}>{saveStructure.isPending ? "Saving…" : "Save fee structure"}</button>
          </div>
          {saveStructure.isError && <p role="alert" className="mt-3 text-sm text-red-600">{saveStructure.error.response?.data?.error || "Could not save fee structure"}</p>}
          {saveStructure.isSuccess && <p className="mt-3 text-sm text-green-700">Fee structure saved.</p>}
        </form>
      )}

      {tab === "payment" && studentId && management.data && (
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-4 text-lg font-semibold">Collect fee payment</h2>
            {!management.data.structure && <p role="status" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Save this student’s fee structure before recording a payment.</p>}
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" className={paymentType === "one-time" ? "btn-primary" : "btn-ghost"} onClick={() => { setPaymentType("one-time"); setAmount(""); savePayment.reset(); }}>One-time fee</button>
              <button type="button" className={paymentType === "monthly" ? "btn-primary" : "btn-ghost"} onClick={() => { setPaymentType("monthly"); setAmount(""); savePayment.reset(); }}>Monthly fee</button>
            </div>
            {paymentType === "monthly" && (
              <div className="mb-4 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Month"><select className="input" value={`${month}-${year}`} onChange={(event) => { const [nextMonth, nextYear] = event.target.value.split("-"); setMonth(nextMonth); setYear(nextYear); setAmount(""); }}>{
                  allMonthsForAcademicYear(currentAcademicYear).map((item) => <option key={`${item.month}-${item.year}`} value={`${item.month}-${item.year}`}>{monthNames[item.month - 1]} {item.year}</option>)
                }</select></Field>
                <Field label="Monthly fee">{money(monthlyFee)}</Field>
              </div>
            )}
            {paymentType === "one-time" && (
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {management.data.items.map((item) => <div key={item.name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{item.name}</span><span className="font-medium">{money(item.amount)}</span></div>)}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Total fee</span><strong>{money(paymentType === "one-time" ? oneTimeTotal : monthlyFee)}</strong></div>
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Previously paid</span><strong>{money(paymentType === "one-time" ? oneTimePaid : monthlyPaid)}</strong></div>
              <div className="rounded-xl bg-amber-50 p-3"><span className="block text-xs text-amber-700">Due amount</span><strong className="text-amber-900">{money(due)}</strong></div>
            </div>
            <form className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-3" onSubmit={calculatePayment}>
              <Field label="This payment"><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">₹</span><input className="input w-full pl-8" type="number" min="0.01" max={due} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={!due || !management.data.structure} /></div></Field>
              <Field label="Remarks"><input className="input w-full" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional" /></Field>
              <button className="btn-primary justify-center" disabled={savePayment.isPending || !due || !management.data.structure || Number(amount) > due}>{savePayment.isPending ? "Saving…" : "Calculate & save payment"}</button>
            </form>
            {savePayment.isError && <p role="alert" className="mt-3 text-sm text-red-600">{savePayment.error.response?.data?.error || "Could not save payment"}</p>}
          </section>

          {receipt && <Receipt payment={receipt.payment} student={receipt.student} />}
          {paymentType === "monthly" && management.data.structure && (
            <div className="card">
              <h3 className="mb-3 font-semibold">Monthly payment status</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {academicMonths.map((item) => {
                  const paidAmount = monthlyPaidByPeriod.get(`${item.month}-${item.year}`) || 0;
                  return <div key={`${item.month}-${item.year}`} className="rounded-lg border border-slate-100 p-3"><span className="block text-sm font-medium">{monthNames[item.month - 1]} {item.year}</span><span className="mt-1 block text-xs text-slate-500">{money(paidAmount)} / {money(monthlyFee)} · {statusFor(monthlyFee, paidAmount)}</span></div>;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "history" && studentId && management.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[["Total", oneTimeTotal + monthlyHistoryTotal], ["Paid", oneTimePaid + monthlyHistoryPaid], ["Due", Math.max(0, oneTimeTotal - oneTimePaid) + Math.max(0, monthlyHistoryTotal - monthlyHistoryPaid)]].map(([label, value]) => <div key={label} className="card"><span className="block text-sm text-slate-500">{label}</span><strong className="mt-1 block text-xl">{money(value)}</strong></div>)}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card"><h3 className="mb-2 font-semibold">One-time</h3><div className="text-sm">Total {money(oneTimeTotal)} · Paid {money(oneTimePaid)} · Due {money(Math.max(0, oneTimeTotal - oneTimePaid))}</div></div>
            <div className="card"><h3 className="mb-2 font-semibold">Monthly</h3><div className="text-sm">Total {money(monthlyHistoryTotal)} · Paid {money(monthlyHistoryPaid)} · Due {money(Math.max(0, monthlyHistoryTotal - monthlyHistoryPaid))}</div></div>
          </div>
          <section className="card p-0 overflow-x-auto">
            <div className="p-4"><h2 className="font-semibold">Payment history · {selectedStudent.user?.name} · Roll {selectedStudent.rollNo || "—"}</h2></div>
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Type</th><th className="th">Month</th><th className="th">Total</th><th className="th">Paid</th><th className="th">Due after payment</th><th className="th">Status</th><th className="th">Receipt</th></tr></thead>
              <tbody>{management.data.payments.map((payment) => <tr key={payment._id} className="border-t border-gray-100"><td className="td">{new Date(payment.paidAt).toLocaleDateString("en-IN")}</td><td className="td">{payment.type === "monthly" ? "Monthly Fee" : "Other / One-Time Fee"}</td><td className="td">{payment.month ? `${monthNames[payment.month - 1]} ${payment.year}` : "—"}</td><td className="td">{money(payment.totalFee)}</td><td className="td">{money(payment.paidAmount)}</td><td className="td">{money(payment.dueAmount)}</td><td className="td">{statusFor(payment.totalFee, payment.totalFee - payment.dueAmount)}</td><td className="td"><button type="button" className="text-brand-700 hover:underline" onClick={() => setReceipt({ payment, student: selectedStudent })}>View / Print</button></td></tr>)}
                {!management.data.payments.length && <tr><td className="td text-center text-slate-500" colSpan="8">No payments recorded for this student.</td></tr>}
              </tbody>
            </table>
          </section>
          <Pagination page={paymentPage} total={management.data.paymentPage.total} limit={25} onChange={setPaymentPage} />
          {receipt && <Receipt payment={receipt.payment} student={receipt.student} />}
        </div>
      )}

      {tab === "report" && (
        <section>
          <div className="card mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Search"><input className="input w-full" maxLength={100} value={reportSearch} onChange={(event) => { setReportSearch(event.target.value); setReportPage(1); }} placeholder="Student, roll, ID, or class" /></Field>
            <Field label="Academic year"><select className="input" value={reportYear} onChange={(event) => { setReportYear(event.target.value); setReportPage(1); }}>{Array.from({ length: 7 }, (_, index) => currentAcademicYear - 3 + index).map((startYear) => <option key={startYear} value={startYear}>{startYear}–{startYear + 1}</option>)}</select></Field>
            <Field label="Month"><select className="input" value={reportMonth} onChange={(event) => { setReportMonth(event.target.value); setReportPage(1); }}><option value="">All months</option>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field>
          </div>
          {report.isLoading && <div className="card mb-4 text-sm text-slate-500">Loading fee report…</div>}
          {report.isError && <p role="alert" className="mb-4 text-sm text-red-600">{report.error.response?.data?.error || "Could not load fee report"}</p>}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[["Total fee", reportSummary.totalFee], ["Total paid", reportSummary.paidAmount], ["Total due", reportSummary.dueAmount]].map(([label, value]) => <div key={label} className="card"><span className="block text-sm text-slate-500">{label}</span><strong className="mt-1 block text-xl">{money(value)}</strong></div>)}
          </div>
          <div className="card p-0 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="th">Roll No.</th><th className="th">Student</th><th className="th">Class</th><th className="th">Type</th><th className="th">Month</th><th className="th">Total fee</th><th className="th">Paid</th><th className="th">Due</th><th className="th">Status</th><th className="th">Date</th></tr></thead>
              <tbody>{reportRows.map((row, index) => <tr key={`${row.student._id}-${row.type}-${row.year || "once"}-${row.month || "once"}-${index}`} className="border-t border-gray-100"><td className="td">{row.student.rollNo || "—"}</td><td className="td">{row.student.user?.name || "—"}</td><td className="td">{row.student.class ? `${row.student.class.name} · ${row.student.class.section || "A"}` : "—"}</td><td className="td">{row.type === "monthly" ? "Monthly Fee" : "Other / One-Time Fee"}</td><td className="td">{row.month ? `${monthNames[row.month - 1]} ${row.year}` : "—"}</td><td className="td">{money(row.totalFee)}</td><td className="td">{money(row.paidAmount)}</td><td className="td">{money(row.dueAmount)}</td><td className="td">{statusFor(row.totalFee, row.paidAmount)}</td><td className="td">{row.date ? new Date(row.date).toLocaleDateString("en-IN") : "—"}</td></tr>)}
                {!report.isLoading && !report.isError && !reportRows.length && <tr><td className="td text-center text-slate-500" colSpan="10">No fee report records found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={reportPage} total={report.data?.pageTotal || 0} limit={25} onChange={setReportPage} />
        </section>
      )}
    </div>
  );
}

function Receipt({ payment, student }) {
  const totalPaid = payment.totalFee - payment.dueAmount;
  return (
    <section className="fee-receipt card border-2 border-slate-200">
      <div className="fee-receipt-actions mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-green-700">Payment saved · Receipt {payment.receiptNo}</h2>
        <button type="button" className="btn-primary justify-center" onClick={() => window.print()}>Print / Save receipt</button>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold">Baal Niketan School</h2>
        <p className="text-sm text-slate-500">Fee payment receipt</p>
      </div>
      <div className="my-4 grid grid-cols-2 gap-2 border-y border-slate-200 py-3 text-sm">
        <div><strong>Student:</strong> {student.user?.name}</div>
        <div><strong>Roll No.:</strong> {student.rollNo || "—"}</div>
        <div><strong>Class:</strong> {student.class ? `${student.class.name} · Section ${student.class.section || "A"}` : "—"}</div>
        <div><strong>Student ID:</strong> {student.admissionNo}</div>
        <div><strong>Receipt:</strong> {payment.receiptNo}</div>
        <div><strong>Date:</strong> {new Date(payment.paidAt).toLocaleDateString("en-IN")}</div>
        {payment.type === "monthly" && <div className="col-span-2"><strong>Month:</strong> {monthNames[payment.month - 1]} {payment.year}</div>}
      </div>
      {payment.type === "one-time" && <div className="mb-4 space-y-1 text-sm">{payment.items.map((item) => <div key={item.name} className="flex justify-between"><span>{item.name}</span><span>{money(item.amount)}</span></div>)}</div>}
      <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
        <div className="flex justify-between"><span>{payment.type === "monthly" ? "Monthly Fee" : "Total Fees"}</span><strong>{money(payment.totalFee)}</strong></div>
        <div className="flex justify-between"><span>This Payment</span><strong>{money(payment.paidAmount)}</strong></div>
        <div className="flex justify-between"><span>Total Paid</span><strong>{money(totalPaid)}</strong></div>
        <div className="flex justify-between"><span>Remaining Fee</span><strong>{money(payment.dueAmount)}</strong></div>
      </div>
      <div className="mt-12 flex justify-end"><div className="min-w-52 border-t border-slate-500 pt-2 text-center text-sm">Director Signature</div></div>
    </section>
  );
}
