import { useMemo, useState } from "react";

import { ConfirmationDialog } from "./confirmation-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type RoleAssignmentFieldProps = {
  selectedRoles: string[];
  availableRoles: string[];
  onChange: (roles: string[]) => void;
  label?: string;
  removeConfirmationContext?: string;
};

export function RoleAssignmentField({
  selectedRoles,
  availableRoles,
  onChange,
  label = "Roles",
  removeConfirmationContext = "this item",
}: RoleAssignmentFieldProps) {
  const [roleToAdd, setRoleToAdd] = useState("");

  const selectableRoles = useMemo(
    () => availableRoles.filter((role) => !selectedRoles.includes(role)),
    [availableRoles, selectedRoles],
  );

  function handleAddRole() {
    if (!roleToAdd) {
      return;
    }
    onChange([...selectedRoles, roleToAdd]);
    setRoleToAdd("");
  }

  function handleRemoveRole(role: string) {
    onChange(selectedRoles.filter((item) => item !== role));
  }

  return (
    <div className="grid gap-2 text-sm">
      <span>{label}</span>
      <div className="flex flex-wrap gap-2">
        {selectedRoles.length > 0 ? (
          selectedRoles.map((role) => (
            <Badge key={role} variant="outline" className="inline-flex items-center gap-1">
              <span>{role}</span>
              <ConfirmationDialog
                triggerLabel="×"
                title="Remove Role"
                description={`Remove role \"${role}\" from ${removeConfirmationContext}?`}
                confirmLabel="Remove"
                confirmTone="danger"
                triggerClassName="border-0 px-1 py-0 leading-none"
                onConfirm={() => handleRemoveRole(role)}
              />
            </Badge>
          ))
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">No roles assigned.</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 min-w-[220px] rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={roleToAdd}
          onChange={(event) => setRoleToAdd(event.target.value)}
        >
          <option value="">Select role</option>
          {selectableRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <Button type="button" onClick={handleAddRole} disabled={!roleToAdd}>Add Role</Button>
      </div>
    </div>
  );
}
