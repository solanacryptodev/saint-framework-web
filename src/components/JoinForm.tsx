"use client";

import { createSignal, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "~/libs/AuthProvider";
import type { PlayerTier } from "~/libs/auth";

interface JoinFormProps {
  selectedTier: PlayerTier;
  tierPrice: string;
  tierLabel: string;
}

export default function JoinForm(props: JoinFormProps) {
  const navigate = useNavigate();
  const { setFromToken } = useAuth();

  // ── Form state ──────────────────────────────────────────────────────────
  const [firstName, setFirstName] = createSignal("");
  const [lastName, setLastName] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [agreedToTerms, setAgreedToTerms] = createSignal(false);

  // ── Submission state ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // ── Field-level validation ─────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string>>(
    {}
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!firstName().trim()) errs.firstName = "Required";
    if (!lastName().trim()) errs.lastName = "Required";

    if (!username().trim()) errs.username = "Required";
    else if (username().length < 3) errs.username = "At least 3 characters";
    else if (!/^[a-zA-Z0-9_]+$/.test(username()))
      errs.username = "Letters, numbers and underscores only";

    if (!email().trim()) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email()))
      errs.email = "Invalid email address";

    if (!password()) errs.password = "Required";
    else if (password().length < 8) errs.password = "At least 8 characters";

    if (!confirmPassword()) errs.confirmPassword = "Required";
    else if (confirmPassword() !== password())
      errs.confirmPassword = "Passwords don't match";

    if (!agreedToTerms()) errs.terms = "You must agree to continue";

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    // Builder tier is coming soon — block submission
    if (props.selectedTier === "builder") {
      setError(
        "Builder tier is coming soon. Please choose Free or Pro to continue."
      );
      return;
    }

    setSubmitting(true);

    try {
      // HTTP route → auth.ts server-side → SurrealDB client.signup()
      // The server handles the WS connection, argon2 hashing, and JWT issuance.
      // Response sets the HttpOnly cookie and returns { token, player }.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // receive Set-Cookie: ace_token
        body: JSON.stringify({
          username: username().trim(),
          email: email().trim().toLowerCase(),
          password: password(),
          first_name: firstName().trim(),
          last_name: lastName().trim(),
          display_name: username().trim(),
          tier: props.selectedTier,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Signup failed");

      // Inject token + player into AuthProvider so the whole app
      // reflects the new session without a page reload
      setFromToken(data.token, data.player);

      // Pro/Builder → start building. Free → browse games.
      navigate(
        props.selectedTier === "free" ? "/play" : "/create/world-forge",
        { replace: true }
      );
    } catch (err) {
      const msg = String(err);

      // Surface friendly errors for common SurrealDB constraint violations
      if (msg.includes("uniqueness") || msg.includes("already exists")) {
        setError("Username or email is already taken. Try a different one.");
      } else if (
        msg.includes("authenticate") ||
        msg.includes("credentials")
      ) {
        setError(
          "Signup succeeded but authentication failed. Please sign in manually."
        );
      } else {
        setError(msg.replace(/^Error:\s*/, ""));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
      <h2 class="text-3xl font-bold text-white mb-8 text-center">
        Create Your Profile
      </h2>

      <form onSubmit={handleSubmit} class="space-y-6">
        {/* Global error */}
        <Show when={error()}>
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error()}
          </div>
        </Show>

        {/* First Name and Last Name */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-white font-semibold mb-2">First Name</label>
            <input
              type="text"
              placeholder="Enter your first name"
              value={firstName()}
              onInput={(e) => {
                setFirstName(e.currentTarget.value);
                setFieldErrors((f) => ({ ...f, firstName: "" }));
              }}
              class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 transition-colors"
              style={{
                "border-color": fieldErrors().firstName
                  ? "#ef4444"
                  : undefined,
              }}
              required
            />
            <Show when={fieldErrors().firstName}>
              <p class="text-red-400 text-xs mt-1">
                {fieldErrors().firstName}
              </p>
            </Show>
          </div>
          <div>
            <label class="block text-white font-semibold mb-2">Last Name</label>
            <input
              type="text"
              placeholder="Enter your last name"
              value={lastName()}
              onInput={(e) => {
                setLastName(e.currentTarget.value);
                setFieldErrors((f) => ({ ...f, lastName: "" }));
              }}
              class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 transition-colors"
              style={{
                "border-color": fieldErrors().lastName ? "#ef4444" : undefined,
              }}
              required
            />
            <Show when={fieldErrors().lastName}>
              <p class="text-red-400 text-xs mt-1">{fieldErrors().lastName}</p>
            </Show>
          </div>
        </div>

        {/* Username */}
        <div>
          <label class="block text-white font-semibold mb-2">Username</label>
          <input
            type="text"
            placeholder="Choose a unique username"
            value={username()}
            onInput={(e) => {
              setUsername(e.currentTarget.value);
              setFieldErrors((f) => ({ ...f, username: "" }));
            }}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 transition-colors"
            style={{
              "border-color": fieldErrors().username ? "#ef4444" : undefined,
            }}
            required
          />
          <Show when={fieldErrors().username}>
            <p class="text-red-400 text-xs mt-1">{fieldErrors().username}</p>
          </Show>
        </div>

        {/* Email */}
        <div>
          <label class="block text-white font-semibold mb-2">
            Email Address
          </label>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email()}
            onInput={(e) => {
              setEmail(e.currentTarget.value);
              setFieldErrors((f) => ({ ...f, email: "" }));
            }}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 transition-colors"
            style={{
              "border-color": fieldErrors().email ? "#ef4444" : undefined,
            }}
            required
          />
          <Show when={fieldErrors().email}>
            <p class="text-red-400 text-xs mt-1">{fieldErrors().email}</p>
          </Show>
        </div>

        {/* Password */}
        <div>
          <label class="block text-white font-semibold mb-2">Password</label>
          <input
            type="password"
            placeholder="Create a strong password"
            value={password()}
            onInput={(e) => {
              setPassword(e.currentTarget.value);
              setFieldErrors((f) => ({ ...f, password: "" }));
            }}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 transition-colors"
            style={{
              "border-color": fieldErrors().password ? "#ef4444" : undefined,
            }}
            required
          />
          <Show when={fieldErrors().password}>
            <p class="text-red-400 text-xs mt-1">{fieldErrors().password}</p>
          </Show>
        </div>

        {/* Confirm Password */}
        <div>
          <label class="block text-white font-semibold mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword()}
            onInput={(e) => {
              setConfirmPassword(e.currentTarget.value);
              setFieldErrors((f) => ({ ...f, confirmPassword: "" }));
            }}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 transition-colors"
            style={{
              "border-color": fieldErrors().confirmPassword
                ? "#ef4444"
                : undefined,
            }}
            required
          />
          <Show when={fieldErrors().confirmPassword}>
            <p class="text-red-400 text-xs mt-1">
              {fieldErrors().confirmPassword}
            </p>
          </Show>
        </div>

        {/* Terms */}
        <div class="flex items-start gap-3">
          <input
            type="checkbox"
            id="terms"
            checked={agreedToTerms()}
            onChange={(e) => {
              setAgreedToTerms(e.currentTarget.checked);
              setFieldErrors((f) => ({ ...f, terms: "" }));
            }}
            class="mt-1 w-4 h-4 accent-yellow-500"
            style={{
              "outline": fieldErrors().terms ? "2px solid #ef4444" : undefined,
              "outline-offset": fieldErrors().terms ? "2px" : undefined,
            }}
            required
          />
          <label for="terms" class="text-slate-300 text-sm">
            I agree to the{" "}
            <A
              href="/terms"
              class="text-yellow-500 hover:text-yellow-400 transition-colors"
            >
              Terms of Service
            </A>{" "}
            and{" "}
            <A
              href="/privacy"
              class="text-yellow-500 hover:text-yellow-400 transition-colors"
            >
              Privacy Policy
            </A>
          </label>
        </div>
        <Show when={fieldErrors().terms}>
          <p class="text-red-400 text-xs -mt-4">{fieldErrors().terms}</p>
        </Show>

        {/* Selected tier summary */}
        <div class="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-white font-semibold">Selected Tier:</span>
            <span class="text-yellow-500 font-bold">{props.tierLabel}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-white font-semibold">Monthly Price:</span>
            <span class="text-white font-bold">{props.tierPrice}</span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting()}
          class="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white font-bold py-4 rounded-lg text-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {submitting()
            ? "Creating your account…"
            : props.selectedTier === "free"
              ? "Create Account & Start Free"
              : `Create Account — ${props.tierPrice}/mo`}
        </button>

        {/* Sign in link */}
        <p class="text-center text-slate-400">
          Already have an account?{" "}
          <A
            href="/login"
            class="text-yellow-500 hover:text-yellow-400 transition-colors"
          >
            Sign in here
          </A>
        </p>
      </form>
    </div>
  );
}