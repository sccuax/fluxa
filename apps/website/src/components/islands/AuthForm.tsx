import { useEffect, useState, type FormEvent } from "react";
import { ButtonPrimary } from "@fluxa/ui";
import { safeNext } from "@/lib/auth/next";
import type { Dictionary } from "@/i18n/en";

// Sign in / create account on the website, against the same better-auth backend the Designer Extension uses (one
// account, one database). Email + password only for now; the session is a cookie set by api.fluxa.agency, which is
// same-site with this page - see data-client lib/webOrigins.ts and the "Web login" section of its CLAUDE.md.
//
// After a successful sign-in it goes to `?next=` (only ever the API's /billing/start, see lib/auth/next.ts) so
// "Upgrade to Pro" -> login -> checkout is one continuous flow; with no `next` it goes home.
type Strings = Dictionary["login"];
type Mode = "signin" | "signup";

interface Props {
  t: Strings;
  apiUrl: string;
  homeHref: string;
  privacyUrl: string;
  termsUrl: string;
  privacyLabel: string;
  termsLabel: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

const fieldClass =
  "h-9 w-full rounded-4 bg-background-white-2 px-3 text-text-md-regular text-text-black placeholder:text-text-secondary/70 outline-none focus-visible:outline-2 focus-visible:outline-accent-500";

export default function AuthForm({ t, apiUrl, homeHref, privacyUrl, termsUrl, privacyLabel, termsLabel }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  // Read `next` once on the client, and skip the form entirely for someone who is already signed in.
  useEffect(() => {
    const validNext = safeNext(new URLSearchParams(window.location.search).get("next"), apiUrl);
    setNext(validNext);
    fetch(`${apiUrl}/api/me`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { user?: unknown } | null) => {
        if (body?.user) window.location.replace(validNext ?? homeHref);
      })
      .catch(() => {});
  }, [apiUrl, homeHref]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (mode === "signup" && !trimmedName) return setError(t.errors.nameRequired);
    if (!EMAIL_PATTERN.test(email.trim())) return setError(t.errors.emailInvalid);
    if (mode === "signup" && password.length < 8) return setError(t.errors.passwordShort);
    if (mode === "signin" && !password) return setError(t.errors.invalidCredentials);

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/${mode === "signin" ? "sign-in" : "sign-up"}/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signin"
            ? { email: email.trim(), password }
            : { email: email.trim(), password, name: trimmedName },
        ),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        if (mode === "signup" && body?.code === USER_EXISTS_CODE) setError(t.errors.emailTaken);
        else if (mode === "signin" && (res.status === 401 || res.status === 400)) setError(t.errors.invalidCredentials);
        else setError(t.errors.generic);
        return;
      }
      window.location.assign(next ?? homeHref);
    } catch {
      setError(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const isSignIn = mode === "signin";

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-[368px] flex-col gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M32 24.0013C32 28.422 28.417 32 24.0013 32C19.5856 32 16.0025 28.417 16.0025 24.0013C16.0025 28.422 12.4195 32 8.00379 32C3.58808 32 0 28.417 0 24.0013C0 19.5856 3.58303 16.0025 7.99874 16.0025C3.58303 15.9975 0 12.4195 0 7.99874C0 5.78836 0.893234 3.78994 2.34159 2.34159C3.78994 0.893234 5.78836 0 7.99874 0H23.9962C28.4119 0 31.995 3.58303 31.995 7.99874C31.995 10.2091 31.1017 12.2075 29.6534 13.6559C28.205 15.1042 26.2066 15.9975 23.9962 15.9975C28.4119 15.9975 31.995 19.5805 31.995 23.9962L32 24.0013Z"
            fill="url(#auth-logo-gradient)"
          />
          <defs>
            <linearGradient id="auth-logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6FF5F1" />
              <stop offset="0.3" stopColor="#3B9DD6" />
              <stop offset="0.504808" stopColor="#0644BB" />
              <stop offset="0.701923" stopColor="#7442A4" />
              <stop offset="1" stopColor="#E23F8C" />
            </linearGradient>
          </defs>
        </svg>
        <h1 className="font-display text-header-h4 text-text-black">{isSignIn ? t.title : t.titleSignUp}</h1>
        {next && <p className="text-text-sm-regular text-text-secondary">{t.checkoutHint}</p>}
      </div>

      {!isSignIn && (
        <label className="flex flex-col gap-1.5 text-text-sm-medium text-text-black">
          {t.name}
          <input
            className={fieldClass}
            type="text"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-text-sm-medium text-text-black">
        {t.email}
        <input
          className={fieldClass}
          type="email"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-text-sm-medium text-text-black">
        {t.password}
        <span className="relative block">
          <input
            className={`${fieldClass} pr-10`}
            type={showPassword ? "text" : "password"}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            aria-label={showPassword ? t.hidePassword : t.showPassword}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-black"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
              {showPassword && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
            </svg>
          </button>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-text-sm-regular text-accent-500">
          {error}
        </p>
      )}

      <div className="flex flex-col items-stretch [&_button]:w-full [&_button]:justify-center">
        <ButtonPrimary type="submit" size="md" disabled={submitting} lazyRipple>
          {submitting ? (isSignIn ? t.signingIn : t.signingUp) : isSignIn ? t.signIn : t.signUp}
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
            <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ButtonPrimary>
      </div>

      <p className="text-center text-text-sm-regular text-text-secondary">
        {isSignIn ? t.noAccount : t.haveAccount}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignIn ? "signup" : "signin");
            setError(null);
          }}
          className="font-medium text-text-black hover:underline"
        >
          {isSignIn ? t.toSignUp : t.toSignIn}
        </button>
      </p>

      <p className="mt-6 flex justify-center gap-4 text-text-sm-regular text-accent-500">
        <a className="underline" href={privacyUrl} target="_blank" rel="noopener noreferrer">
          {privacyLabel}
        </a>
        <a className="underline" href={termsUrl} target="_blank" rel="noopener noreferrer">
          {termsLabel}
        </a>
      </p>
    </form>
  );
}
