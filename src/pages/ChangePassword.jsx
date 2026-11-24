import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { schoolBrand } from "../branding";
import SchoolLogo from "../components/SchoolLogo";
import PasswordInput from "../components/PasswordInput";

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <SchoolLogo className="h-14 w-14" />
          <div className="min-w-0">
            <div className="font-bold text-slate-900">{schoolBrand.name}</div>
            <div className="mt-1 text-xs text-slate-500">{user?.name} · {user?.role}</div>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{user?.mustChangePassword ? "Set your new password" : "Change password"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {user?.mustChangePassword
            ? "For your security, update the temporary password before continuing."
            : "Choose a strong password that you have not used before."}
        </p>

        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="current-password" className="label">Current password</label>
            <PasswordInput id="current-password" className="input" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="new-password" className="label">New password</label>
            <PasswordInput id="new-password" className="input" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="confirm-password" className="label">Confirm new password</label>
            <PasswordInput id="confirm-password" className="input" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </div>
          <button className="btn-primary min-h-12 w-full justify-center" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
          {!user?.mustChangePassword && <button type="button" className="btn-ghost w-full justify-center" onClick={() => { logout(); navigate("/login", { replace: true }); }}>Sign out</button>}
        </div>
      </form>
    </main>
  );
}
