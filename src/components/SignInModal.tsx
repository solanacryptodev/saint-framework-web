"use client";
// src/components/SignInModal.tsx
//
// Full-screen sign-in modal. Triggered from Nav when user clicks "Login".
// Handles username/email + password authentication via AuthProvider.

import { createSignal, Show } from "solid-js";
import { useAuth } from "~/libs/AuthProvider";

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SignInModal(props: SignInModalProps) {
    const { signin, error } = useAuth();

    const [identifier, setIdentifier] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [signingIn, setSigningIn] = createSignal(false);
    const [localError, setLocalError] = createSignal<string | null>(null);

    async function handleSignin(e: Event) {
        e.preventDefault();
        if (!identifier().trim() || !password()) return;

        setSigningIn(true);
        setLocalError(null);

        try {
            await signin({ identifier: identifier(), password: password() });
            // Success — close modal and reset form
            props.onClose();
            setIdentifier("");
            setPassword("");
        } catch (err: any) {
            setLocalError(err?.message ?? "Sign in failed. Please try again.");
        } finally {
            setSigningIn(false);
        }
    }

    function handleClose() {
        if (!signingIn()) {
            props.onClose();
            setIdentifier("");
            setPassword("");
            setLocalError(null);
        }
    }

    return (
        <Show when={props.isOpen}>
            {/* Backdrop */}
            <div
                class="fixed inset-0 z-[100]"
                style={{ background: "rgba(0,0,0,0.7)", animation: "modalFadeIn 0.2s ease" }}
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                class="fixed inset-0 z-[101] flex items-center justify-center p-4"
                style={{ animation: "modalSlideIn 0.25s cubic-bezier(0.34, 1.2, 0.64, 1)" }}
            >
                <div
                    class="w-full max-w-[380px] overflow-hidden"
                    style={{
                        background: "rgba(8, 12, 20, 0.97)",
                        border: "1px solid rgba(245, 197, 24, 0.22)",
                        "border-radius": "16px",
                        "box-shadow": "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,197,24,0.06) inset",
                    }}
                >
                    {/* Header */}
                    <div class="flex items-center justify-between px-6 pt-6 pb-4">
                        <span
                            class="text-lg font-bold tracking-wide"
                            style={{ color: "#f5c518", "font-family": "'Goldman', sans-serif" }}
                        >
                            Welcome back
                        </span>
                        <button
                            onClick={handleClose}
                            disabled={signingIn()}
                            class="text-slate-600 hover:text-slate-400 transition-colors text-lg px-1 disabled:opacity-50"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSignin} class="px-6 pb-6 space-y-4">
                        {/* Error message */}
                        <Show when={localError() || error()}>
                            <div
                                class="rounded-lg px-4 py-3 text-sm"
                                style={{
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    color: "#f87171",
                                }}
                            >
                                {localError() || error()}
                            </div>
                        </Show>

                        {/* Username / Email */}
                        <div>
                            <label class="block text-slate-400 text-xs font-medium mb-1.5 tracking-wide uppercase">
                                Username or Email
                            </label>
                            <input
                                type="text"
                                value={identifier()}
                                onInput={(e) => setIdentifier(e.currentTarget.value)}
                                placeholder="your_username"
                                autocomplete="username"
                                disabled={signingIn()}
                                class="w-full rounded-lg px-4 py-3 text-white text-sm placeholder-slate-600 transition-colors focus:outline-none disabled:opacity-50"
                                style={{
                                    background: "rgba(30, 41, 59, 0.6)",
                                    border: "1px solid rgba(245, 197, 24, 0.15)",
                                }}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label class="block text-slate-400 text-xs font-medium mb-1.5 tracking-wide uppercase">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password()}
                                onInput={(e) => setPassword(e.currentTarget.value)}
                                placeholder="••••••••"
                                autocomplete="current-password"
                                disabled={signingIn()}
                                class="w-full rounded-lg px-4 py-3 text-white text-sm placeholder-slate-600 transition-colors focus:outline-none disabled:opacity-50"
                                style={{
                                    background: "rgba(30, 41, 59, 0.6)",
                                    border: "1px solid rgba(245, 197, 24, 0.15)",
                                }}
                            />
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={signingIn() || !identifier() || !password()}
                            class="w-full rounded-lg py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{
                                background: "linear-gradient(135deg, #f5c518, #d97706)",
                                color: "#000",
                            }}
                        >
                            <Show when={signingIn()}>
                                {/* Loading spinner */}
                                <svg
                                    class="animate-spin h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        class="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        stroke-width="4"
                                    />
                                    <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                            </Show>
                            {signingIn() ? "Signing in…" : "Login"}
                        </button>
                    </form>

                    {/* Footer */}
                    <div
                        class="px-6 py-4 text-center"
                        style={{ "border-top": "1px solid rgba(245, 197, 24, 0.1)" }}
                    >
                        <span class="text-slate-500 text-xs">
                            Don't have an account?{" "}
                            <a
                                href="/join"
                                onClick={handleClose}
                                class="text-yellow-500 hover:text-yellow-400 transition-colors font-medium"
                            >
                                Join here →
                            </a>
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
        </Show>
    );
}