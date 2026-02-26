import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";

type ConfirmationDialogProps = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "default" | "danger";
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  triggerClassName?: string;
};

export function ConfirmationDialog({
  triggerLabel,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "default",
  onConfirm,
  disabled = false,
  triggerClassName = "",
}: ConfirmationDialogProps) {
  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" disabled={disabled} className={triggerClassName}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button">{cancelLabel}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              type="button"
              onClick={handleConfirm}
              className={
                confirmTone === "danger"
                  ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                  : ""
              }
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
