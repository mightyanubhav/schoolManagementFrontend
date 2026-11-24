import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function Timetable() {
  const { user } = useAuth();
  if (user?.role?.trim().toLowerCase() === "student") return <StudentTimetable />;
  return <ClassTimetable />;
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
