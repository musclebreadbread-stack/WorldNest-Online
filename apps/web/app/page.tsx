"use client";

import Link from "next/link";
import { useAuthStore } from "../src/stores/authStore";

export default function Home() {
  const { user, loading } = useAuthStore();

  const playHref = user ? "/game" : "/auth";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-worldnest-dark to-black text-white">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold tracking-tight">
          World<span className="text-worldnest-secondary">Nest</span> Online
        </h1>
        <p className="mb-2 text-xl text-gray-300">
          A browser-based 2D MMO life simulation game
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Explore procedurally generated worlds, build, and play with friends
        </p>
        <Link
          href={playHref}
          className="inline-flex items-center rounded-lg bg-worldnest-primary px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-indigo-500 hover:scale-105"
        >
          {loading ? "Loading..." : "Play Now"}
        </Link>
      </div>
    </main>
  );
}
