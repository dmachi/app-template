import { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-1 focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-slate-600 ${className}`}
      {...props}
    />
  );
}
