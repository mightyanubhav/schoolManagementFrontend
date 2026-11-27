import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Field, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function Timetable() {
  const { user } = useAuth();
  if (user?.role?.trim().toLowerCase() === "student") return <StudentTimetable />;
  return user?.role?.trim().toLowerCase() === "admin" ? <AdminTimetable /> : <ClassTimetable />;
}

const blankSlot = () => ({ day: "Mon", start: "08:00", end: "08:45", subject: "", teacher: "", room: "" });
const todayInput = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const sixMonthDate = () => {
  const date = new Date();
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 6);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function AdminTimetable() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState([]);
  const [reviewDueDate, setReviewDueDate] = useState(sixMonthDate);
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then((response) => response.data) });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api.get("/subjects").then((response) => response.data) });
  const teachers = useQuery({
    queryKey: ["timetable-teachers"],
    queryFn: () => api.get("/teachers", { params: { limit: 100 } }).then((response) => response.data),
  });
  const timetable = useQuery({
    queryKey: ["timetable", classId],
    queryFn: () => api.get(`/timetable/${classId}`).then((response) => response.data),
    enabled: !!classId,
  });
  const save = useMutation({
    mutationFn: (body) => api.put(`/timetable/${classId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable", classId] });
      qc.invalidateQueries({ queryKey: ["timetable-reviews"] });
    },
  });

  useEffect(() => {
    if (!timetable.data || !classId) return;
    setSlots((timetable.data.slots || []).map((slot) => ({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subject: slot.subject?._id || "",
      teacher: slot.teacher?._id || "",
      room: slot.room || "",
    })));
    const storedReviewDate = timetable.data.reviewDueDate?.slice(0, 10);
    setReviewDueDate(storedReviewDate && storedReviewDate >= todayInput() ? storedReviewDate : sixMonthDate());
  }, [classId, timetable.data]);

  const activeClass = classes.data?.find((item) => item._id === classId);
  const availableSubjects = subjects.data?.filter((subject) => subject.class?._id === classId) || [];
  const slotUpdate = (index, changes) => setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...changes } : slot));

  function submit(event) {
    event.preventDefault();
    save.mutate({
      reviewDueDate,
      slots: slots.map(({ day, start, end, subject, teacher, room }) => ({ day, start, end, subject, teacher, room })),
    });
  }

  return (
    <div>
      <PageHeader title="Timetable" subtitle={`Distribute subject periods across the school week${activeClass ? ` · ${activeClass.name} · Section ${activeClass.section || "A"}` : ""}`} />
      <section className="card mb-4 grid gap-4 sm:grid-cols-[minmax(14rem,1fr)_minmax(16rem,2fr)]">
        <Field label="Class"><select className="input w-full" value={classId} onChange={(event) => { setClassId(event.target.value); save.reset(); }}><option value="">Select class</option>{classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}</select></Field>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Review and update each class timetable every six months. Choose the date for the next review; the admin dashboard will show a reminder during the 30 days before it is due.</div>
      </section>
      {classId && timetable.isLoading && <div className="card text-sm text-slate-500">Loading timetable…</div>}
      {timetable.isError && <div role="alert" className="card mb-4 text-sm text-red-600">{timetable.error.response?.data?.error || "Could not load timetable"}</div>}
      {classId && timetable.data && <form className="space-y-4" onSubmit={submit}>
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Subject-wise time distribution</h2><p className="text-sm text-slate-500">Add one row for every subject period in the weekly schedule.</p></div>
            <button type="button" className="btn-ghost" onClick={() => setSlots((current) => [...current, blankSlot()])}>Add period</button>
          </div>
          <div className="space-y-3">
            {slots.map((slot, index) => {
              const subject = subjects.data?.find((item) => item._id === slot.subject);
              const teacherOptions = teachers.data?.filter((teacher) => !subject?.teacher || subject.teacher._id === teacher._id) || [];
              return <div key={`period-${index}`} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-7">
                <Field label="Day"><select className="input w-full" value={slot.day} onChange={(event) => slotUpdate(index, { day: event.target.value })}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <option key={day} value={day}>{day}</option>)}</select></Field>
                <Field label="Subject"><select className="input w-full" value={slot.subject} onChange={(event) => { const selected = subjects.data?.find((item) => item._id === event.target.value); slotUpdate(index, { subject: event.target.value, teacher: selected?.teacher?._id || "" }); }} required><option value="">Select subject</option>{availableSubjects.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}</select></Field>
                <Field label="Teacher"><select className="input w-full" value={slot.teacher} onChange={(event) => slotUpdate(index, { teacher: event.target.value })}><option value="">Select teacher</option>{teacherOptions.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.user?.name}</option>)}</select></Field>
                <Field label="Start"><input className="input w-full" type="time" value={slot.start} onChange={(event) => slotUpdate(index, { start: event.target.value })} required /></Field>
                <Field label="End"><input className="input w-full" type="time" value={slot.end} onChange={(event) => slotUpdate(index, { end: event.target.value })} required /></Field>
                <Field label="Room"><input className="input w-full" value={slot.room} maxLength={40} onChange={(event) => slotUpdate(index, { room: event.target.value })} placeholder="Optional" /></Field>
                <button type="button" className="h-10 text-sm text-red-600 hover:underline" onClick={() => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))}>Remove</button>
              </div>;
            })}
            {!slots.length && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No periods yet. Add a period to start building this class schedule.</div>}
          </div>
        </section>
        <section className="card grid gap-4 sm:grid-cols-[minmax(14rem,1fr)_2fr] sm:items-end">
          <Field label="Next timetable review date"><input className="input w-full" type="date" min={todayInput()} value={reviewDueDate} onChange={(event) => setReviewDueDate(event.target.value)} required /></Field>
          <p className="text-sm text-slate-500">Default is six months from today. Admin reminders appear 30 days before this date and remain until the timetable is reviewed and saved.</p>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={save.isPending || !slots.every((slot) => slot.subject)}>{save.isPending ? "Saving…" : "Save timetable"}</button>
            {save.isSuccess && <span role="status" className="text-sm text-green-700">Timetable and review date saved.</span>}
            {save.isError && <span role="alert" className="text-sm text-red-600">{save.error.response?.data?.error || "Could not save timetable"}</span>}
          </div>
        </section>
      </form>}
    </div>
  );
}

function StudentTimetable() {
  const timetable = useQuery({
    queryKey: ["timetable", "me"],
    queryFn: () => api.get("/timetable/me").then((response) => response.data),
  });

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`Weekly schedule${timetable.data?.class?.name ? ` · ${timetable.data.class.name} · Section ${timetable.data.class.section || "A"}` : ""}`}
      />
      {timetable.isLoading && <div className="card text-sm text-slate-500">Loading your class timetable…</div>}
      {timetable.isError && <div role="alert" className="card text-sm text-red-600">{timetable.error.response?.data?.error || "Could not load your class timetable"}</div>}
      {timetable.data && <TimetableGrid slots={timetable.data.slots || []} />}
    </div>
  );
}

function ClassTimetable() {
  const [classId, setClassId] = useState("");
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => api.get("/classes").then((response) => response.data) });
  const timetable = useQuery({
    queryKey: ["timetable", classId],
    queryFn: () => api.get(`/timetable/${classId}`).then((response) => response.data),
    enabled: !!classId,
  });

  return (
    <div>
      <PageHeader title="Timetable" subtitle={`Weekly schedule${timetable.data?.class?.name ? ` · ${timetable.data.class.name} · Section ${timetable.data.class.section || "A"}` : ""}`} />
      <div className="card mb-4">
        <label className="label">Class</label>
        <select className="input w-full max-w-xs" value={classId} onChange={(event) => setClassId(event.target.value)}>
          <option value="">Select class</option>
          {classes.data?.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.name} · Section {schoolClass.section || "A"}</option>)}
        </select>
      </div>
      {timetable.isLoading && <div className="card text-sm text-slate-500">Loading timetable…</div>}
      {timetable.isError && <div role="alert" className="card text-sm text-red-600">{timetable.error.response?.data?.error || "Could not load timetable"}</div>}
      {classId && timetable.data && <TimetableGrid slots={timetable.data.slots || []} />}
    </div>
  );
}

function TimetableGrid({ slots }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {DAYS.map((day) => {
        const daySlots = slots.filter((slot) => slot.day === day);
        return (
          <div key={day} className="card min-w-0">
            <div className="mb-3 font-semibold text-slate-900">{day}</div>
            <div className="space-y-2">
              {daySlots.map((slot, index) => (
                <div key={slot._id || `${slot.start}-${slot.subject?._id || index}`} className="border-l-2 border-brand-500 pl-2">
                  <div className="text-xs text-gray-500">{slot.start}–{slot.end}</div>
                  <div className="text-sm font-medium">{slot.subject?.name}</div>
                  <div className="text-xs text-gray-500">{slot.teacher?.user?.name} · {slot.room}</div>
                </div>
              ))}
              {!daySlots.length && <div className="text-xs text-gray-400">Free</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
