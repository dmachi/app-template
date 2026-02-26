import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type AuthDropdownItem = {
  label: string;
  onSelect: () => void;
};

type AuthMenuProps = {
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
        <Button type="button" className="h-10 w-10 rounded-full p-0" aria-label="User menu">
          <span className="text-base">👤</span>
        </Button>
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
