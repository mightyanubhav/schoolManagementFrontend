
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { schoolBrand } from "../branding";
import SchoolLogo from "../components/SchoolLogo";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");

    try {
      const signedInUser = await login(identifier, password);
      nav(signedInUser.mustChangePassword ? "/change-password" : "/");
    } catch (e) {
      setErr(e.response?.data?.error || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_.95fr]">

      {/* Desktop Branding Panel */}
      <section className="relative hidden h-screen overflow-hidden bg-slate-950 px-8 py-6 text-white lg:flex lg:items-center lg:justify-center xl:px-12">

        <div className="absolute -right-36 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-20 h-[30rem] w-[30rem] rounded-full bg-amber-100/10 blur-3xl" />

        <div className="relative flex w-full max-w-xl flex-col items-center text-center">

          <SchoolLogo className="h-36 w-36 xl:h-44 xl:w-44" />

          <h1 className="mt-3 text-xl font-bold tracking-tight xl:text-2xl">
            {schoolBrand.name}
          </h1>

          <p className="mt-1 text-xs text-slate-300">
            {schoolBrand.address}
          </p>

          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100">
            {schoolBrand.motto}
          </p>

          <div className="my-5 h-px w-14 bg-white/20" />

          {/* Director */}
          <div className="w-full max-w-lg">

            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
              School Administration
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Vicky Kumar Das
            </h2>

            <p className="mt-0.5 text-xs text-slate-400">
              Director
            </p>

            {/* Horizontal Contact Details */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-y border-white/10 py-4">

              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Mobile
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  9263349380
                </p>
              </div>

              <div className="hidden h-8 w-px bg-white/15 sm:block" />

              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  WhatsApp
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  7761872877
                </p>
              </div>

              <div className="hidden h-8 w-px bg-white/15 sm:block" />

              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Email
                </p>
                <a
                  href="mailto:bkp21385@gmail.com"
                  className="mt-1 block text-sm font-medium text-white transition hover:text-amber-100"
                >
                  bkp21385@gmail.com
                </a>
              </div>

            </div>

          </div>

          {/* School Features */}
          {/* <div className="mt-5 grid w-full grid-cols-3 gap-3 text-xs text-slate-300">

            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3">
              Attendance
              <span className="mt-1 block text-white">
                Stay in sync
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3">
              Learning
              <span className="mt-1 block text-white">
                Track progress
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3">
              Community
              <span className="mt-1 block text-white">
                Share updates
              </span>
            </div>

          </div> */}

        </div>
      </section>

      {/* Login Section */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-6 sm:px-8 lg:h-screen lg:min-h-0 lg:bg-white">

        {/* Mobile Background Effects */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl lg:hidden" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-amber-100/10 blur-3xl lg:hidden" />

        <form
          onSubmit={submit}
          className="relative w-full max-w-md"
        >

          {/* Mobile Branding */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">

            {/* Logo without border or background */}
            <SchoolLogo className="h-24 w-24 sm:h-28 sm:w-28" />

            <h1 className="mt-3 text-xl font-bold tracking-tight text-white">
              {schoolBrand.name}
            </h1>

            <p className="mt-1 text-xs text-slate-400">
              {schoolBrand.address}
            </p>

            <div className="mt-3 h-1 w-10 rounded-full bg-amber-100/80" />

          </div>

          {/* Login Heading */}
          <div className="mb-8">

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-400 lg:text-brand-700">
              SCHOOL PORTAL
            </p>

            <h2 className="text-3xl font-bold tracking-tight text-white lg:text-slate-950">
              Welcome back
            </h2>

            <p className="mt-2 text-sm text-slate-400 lg:text-slate-500">
              Sign in to access your account.
            </p>

          </div>

          {/* Error Message */}
          {err && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 lg:border-rose-200 lg:bg-rose-50 lg:text-rose-700"
            >
              {err}
            </div>
          )}

          {/* Login Fields */}
          <div className="space-y-5">

            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-300 lg:text-slate-700"
                htmlFor="login-identifier"
              >
                Email, mobile number, or ID
              </label>

              <input
                id="login-identifier"
                className="input min-h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 text-white placeholder:text-slate-500 focus:border-brand-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 lg:border-slate-200 lg:bg-slate-50 lg:text-slate-900 lg:focus:bg-white"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email / mobile / student or staff ID"
                required
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-300 lg:text-slate-700"
                htmlFor="login-password"
              >
                Password
              </label>

              <PasswordInput
                id="login-password"
                className="input min-h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 text-white placeholder:text-slate-500 focus:border-brand-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 lg:border-slate-200 lg:bg-slate-50 lg:text-slate-900 lg:focus:bg-white"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              className="btn-primary min-h-12 w-full justify-center rounded-xl text-sm font-semibold shadow-lg shadow-brand-600/20 transition active:scale-[0.98]"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in to your account"}
            </button>

          </div>

          {/* Footer */}
          <p className="mt-7 text-center text-xs text-slate-500 lg:text-slate-400">
            Secure school access
          </p>

        </form>
      </section>
    </div>
  );
}
