"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-worldnest-dark to-black text-white">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold tracking-tight">
          World<span className="text-worldnest-secondary">Nest</span> Online
        </h1>
        <p className="mb-8 text-xl text-gray-300">
          A browser-based 2D MMO life simulation game
        </p>
        <Link
          href="/game"
          className="inline-flex items-center rounded-lg bg-worldnest-primary px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-indigo-500 hover:scale-105"
        >
          Enter World
        </Link>
      </div>
    </main>
  );
}
