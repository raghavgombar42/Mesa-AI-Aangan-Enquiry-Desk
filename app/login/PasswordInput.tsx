"use client";

import { useState } from "react";

export function PasswordInput() {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center rounded border border-stone-300 focus-within:border-stone-500">
      <input
        type={show ? "text" : "password"}
        name="password"
        placeholder="Password"
        autoFocus
        autoComplete="current-password"
        className="min-w-0 flex-1 rounded px-2 py-1.5 outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="px-2 text-xs text-stone-500 hover:text-stone-900"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
