import { Badge } from "../ui/badge";

type RoleBadgesProps = {
  roles: string[];
  emptyLabel?: string;
};

export function RoleBadges({ roles, emptyLabel = "no roles" }: RoleBadgesProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {roles.length > 0 ? (
        roles.map((role) => (
          <Badge key={role} variant="outline">
            {role}
          </Badge>
        ))
      ) : (
        <Badge variant="secondary" className="text-slate-500 dark:text-slate-400">
          {emptyLabel}
        </Badge>
      )}
    </div>
  );
}