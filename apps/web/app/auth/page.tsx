"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "../../src/i18n/useTranslation";
import { useAuthStore } from "../../src/stores/authStore";

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setSession } = useAuthStore();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const { signIn } = await import("@worldnest/database");
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        if (result.user) {
          setUser({
            id: result.user.id,
            email: result.user.email || "",
            username:
              result.user.user_metadata?.username ||
              result.user.email?.split("@")[0] ||
              "Player",
          });
          setSession(result.session);
          router.push("/game");
        }
      } else {
        const { signUp } = await import("@worldnest/database");
        const result = await signUp(email, password, username);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        if (result.user) {
          setUser({
            id: result.user.id,
            email: result.user.email || "",
            username: username || result.user.email?.split("@")[0] || "Player",
          });
          router.push("/game");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-worldnest-dark to-black">
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          World<span className="text-worldnest-secondary">Nest</span> Online
        </h1>
        <p className="mb-6 text-center text-sm text-gray-400">
          {isLogin ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-300">
                {t("auth.usernameLabel")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-worldnest-primary focus:outline-none focus:ring-1 focus:ring-worldnest-primary"
                placeholder={t("auth.usernamePlaceholder")}
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300">
              {t("auth.emailLabel")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-worldnest-primary focus:outline-none focus:ring-1 focus:ring-worldnest-primary"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              {t("auth.passwordLabel")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-worldnest-primary focus:outline-none focus:ring-1 focus:ring-worldnest-primary"
              placeholder={t("auth.passwordPlaceholder")}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-worldnest-primary px-4 py-3 font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? t("auth.submitting")
              : isLogin
                ? t("auth.signIn")
                : t("auth.signUp")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-sm text-worldnest-secondary hover:underline"
          >
            {isLogin ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
          </button>
        </div>
      </div>
    </main>
  );
}
