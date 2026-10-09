"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  confirmText,
  className,
  name,
  value,
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  confirmText?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={`${className ?? ""} disabled:opacity-50`}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
