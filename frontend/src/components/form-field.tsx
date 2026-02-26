import { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
};

export function FormField({ label, children }: FormFieldProps) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
