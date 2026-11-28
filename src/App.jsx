import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Subjects from "./pages/Subject";
import Attendance from "./pages/Attendance";
import Exams from "./pages/Exams";
import AdmitCards from "./pages/AdmitCards";
import Fees from "./pages/Fees";
import Announcements from "./pages/Announcements";
import Timetable from "./pages/Timetable";
import Reports from "./pages/Reports";
import ChangePassword from "./pages/ChangePassword";
import Salary from "./pages/Salary";

function Protected({ children, allowPasswordUpdate = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !allowPasswordUpdate) return <Navigate to="/change-password" replace />;
  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<Protected allowPasswordUpdate><ChangePassword /></Protected>} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<RoleRoute roles={["admin", "teacher"]}><Students /></RoleRoute>} />
        <Route path="teachers" element={<RoleRoute roles={["admin"]}><Teachers /></RoleRoute>} />
        <Route path="classes" element={<RoleRoute roles={["admin", "teacher"]}><Classes /></RoleRoute>} />
        <Route path="subjects" element={<RoleRoute roles={["admin", "teacher"]}><Subjects /></RoleRoute>} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="exams" element={<Exams />} />
        <Route path="admit-cards" element={<RoleRoute roles={["admin", "student"]}><AdmitCards /></RoleRoute>} />
        <Route path="fees" element={<RoleRoute roles={["admin", "student", "parent"]}><Fees /></RoleRoute>} />
        <Route path="salary" element={<RoleRoute roles={["admin"]}><Salary /></RoleRoute>} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="reports" element={<RoleRoute roles={["admin"]}><Reports /></RoleRoute>} />
      </Route>
    </Routes>
  );
}