import { FormEvent, useState } from "react";

import { FormField } from "../form-field";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";

type CreateGroupDialogProps = {
  triggerLabel?: string;
  onCreate: (values: { name: string; description: string }) => Promise<void>;
};

export function CreateGroupDialog({ triggerLabel = "Create Group", onCreate }: CreateGroupDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onCreate({ name, description });
      setIsOpen(false);
      setName("");
      setDescription("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create group");
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
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Provide a group name and optional description.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <FormField label="Group name">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
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
              {saving ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
