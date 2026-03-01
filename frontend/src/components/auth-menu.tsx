import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export type AuthDropdownItem = {
  label: string;
  onSelect: () => void;
};

export type AuthMenuProps = {
  isAuthenticated: boolean;
  currentUserName?: string;
  registrationEnabled: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onSettings: () => void;
  onLogout: () => void;
  extraMenuItems?: AuthDropdownItem[];
};

export function AuthMenu({
  isAuthenticated,
  currentUserName,
  registrationEnabled,
  onLogin,
  onRegister,
  onSettings,
  onLogout,
  extraMenuItems = [],
}: AuthMenuProps) {
  const avatarLabel = (currentUserName || "User").trim();
  const avatarInitials = avatarLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" onClick={onLogin}>
          Login
        </Button>
        {registrationEnabled ? (
          <Button type="button" onClick={onRegister}>
            Register
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="User menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-xs font-medium">{avatarInitials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{currentUserName || "User"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSettings}>Settings</DropdownMenuItem>
        {extraMenuItems.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={onLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
