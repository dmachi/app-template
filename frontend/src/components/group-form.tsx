import { FormEvent, useState } from "react";

import { FormField } from "./form-field";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type GroupFormValues = {
  name: string;
  description: string;
};

type GroupFormProps = {
  initialValues?: GroupFormValues;
  submitLabel: string;
  onSubmit: (values: GroupFormValues) => Promise<void>;
};

export function GroupForm({ initialValues, submitLabel, onSubmit }: GroupFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, description });
      if (!initialValues) {
        setName("");
        setDescription("");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save group");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <FormField label="Name">
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </FormField>
      <FormField label="Description">
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      <Button disabled={saving} type="submit">
        {saving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
