import { FormEvent, useEffect, useState } from "react";

import { FormField } from "../form-field";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";

type RoleDialogProps = {
  triggerLabel: string;
  title: string;
  descriptionText: string;
  initialName?: string;
  initialDescription?: string;
  nameReadOnly?: boolean;
  submitLabel: string;
  onSubmit: (values: { name: string; description: string }) => Promise<void>;
};

export function RoleDialog({
  triggerLabel,
  title,
  descriptionText,
  initialName = "",
  initialDescription = "",
  nameReadOnly = false,
  submitLabel,
  onSubmit,
}: RoleDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName(initialName);
    setDescription(initialDescription);
    setError(null);
  }, [isOpen, initialName, initialDescription]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name, description });
      setIsOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <FormField label="Role name">
            <Input value={name} onChange={(event) => setName(event.target.value)} readOnly={nameReadOnly} required />
          </FormField>
          <FormField label="Description (optional)">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </FormField>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
