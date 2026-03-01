import * as React from "react";
import { GripVertical, PanelLeft } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}

type SidebarProviderProps = React.PropsWithChildren<{
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

export function SidebarProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: SidebarProviderProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = typeof openProp === "boolean" ? openProp : internalOpen;

  const setOpen = React.useCallback((nextOpen: boolean) => {
    if (typeof openProp !== "boolean") {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }, [onOpenChange, openProp]);

  const toggleSidebar = React.useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const value = React.useMemo<SidebarContextValue>(() => ({
    state: open ? "expanded" : "collapsed",
    open,
    setOpen,
    toggleSidebar,
  }), [open, setOpen, toggleSidebar]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

type SidebarProps = React.HTMLAttributes<HTMLElement> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

export function Sidebar({
  className,
  side = "left",
  variant = "sidebar",
  collapsible = "icon",
  ...props
}: SidebarProps) {
  const { state } = useSidebar();

  return (
    <aside
      data-slot="sidebar"
      data-side={side}
      data-variant={variant}
      data-collapsible={collapsible}
      data-state={state}
      className={cn(
        "relative w-full overflow-visible",
        className,
      )}
      {...props}
    />
  );
}

export const SidebarRail = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <button
        ref={ref}
        type="button"
        aria-label="Toggle sidebar"
        className={cn(
          "absolute right-0 top-1/2 z-40 h-16 w-4 translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-300 bg-white/90 text-slate-500 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-800",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) {
            return;
          }
          toggleSidebar();
        }}
        {...props}
      >
        <GripVertical className="mx-auto h-4 w-4" />
      </button>
    );
  },
);
SidebarRail.displayName = "SidebarRail";

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sidebar-content" className={cn("grid gap-3", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section data-slot="sidebar-group" className={cn("grid gap-2", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="sidebar-group-label"
      className={cn("px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400", className)}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sidebar-group-content" className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul data-slot="sidebar-menu" className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li data-slot="sidebar-menu-item" className={cn("grid gap-1", className)} {...props} />;
}

type SidebarMenuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean;
};

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, isActive = false, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      className={cn(
        "flex items-center justify-start gap-2 border-0",
        isActive ? "bg-slate-100 dark:bg-slate-800" : "",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export function SidebarMenuSub({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul data-slot="sidebar-menu-sub" className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenuSubItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li data-slot="sidebar-menu-sub-item" className={cn(className)} {...props} />;
}

export const SidebarMenuSubButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, isActive = false, ...props }, ref) => (
    <SidebarMenuButton
      ref={ref}
      isActive={isActive}
      className={cn("text-sm", className)}
      {...props}
    />
  ),
);
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();
    return (
      <Button
        ref={ref}
        type="button"
        className={cn("inline-flex items-center gap-2", className)}
        onClick={toggleSidebar}
        {...props}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    );
  },
);
SidebarTrigger.displayName = "SidebarTrigger";
