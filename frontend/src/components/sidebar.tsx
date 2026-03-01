import { useEffect, useState, type ReactNode } from "react";

import { Sheet, SheetContent } from "./ui/sheet";
import { Sidebar as UISidebar, SidebarRail, SidebarProvider } from "./ui/sidebar";

type SidebarType = "fixed" | "resizable";

export type SidebarResizableLevel = {
  id: string;
  minViewportWidth: number;
  widthClassName: string;
  iconMode?: boolean;
};

const DEFAULT_RESIZABLE_LEVELS: SidebarResizableLevel[] = [
  {
    id: "full",
    minViewportWidth: 1200,
    widthClassName: "w-56",
    iconMode: false,
  },
  {
    id: "mini",
    minViewportWidth: 1024,
    widthClassName: "w-14",
    iconMode: true,
  },
];

type SidebarRenderContext = {
  iconMode: boolean;
};

type SidebarProps = {
  type?: SidebarType;
  fixedWidthClassName?: string;
  resizableLevels?: SidebarResizableLevel[];
  overlayWidthClassName?: string;
  children: ReactNode | ((context: SidebarRenderContext) => ReactNode);
};

function getSortedLevels(levels: SidebarResizableLevel[]): SidebarResizableLevel[] {
  return [...levels].sort((left, right) => right.minViewportWidth - left.minViewportWidth);
}

function resolveLevel(width: number, levels: SidebarResizableLevel[]): SidebarResizableLevel | null {
  for (const level of levels) {
    if (width >= level.minViewportWidth) {
      return level;
    }
  }
  return null;
}

function getInitialViewportWidth(): number {
  if (typeof window === "undefined") {
    return 1920;
  }
  return window.innerWidth;
}

export function Sidebar({
  type = "resizable",
  fixedWidthClassName = "w-56",
  resizableLevels = DEFAULT_RESIZABLE_LEVELS,
  overlayWidthClassName,
  children,
}: SidebarProps) {
  const normalizedLevels = resizableLevels.length > 0 ? resizableLevels : DEFAULT_RESIZABLE_LEVELS;
  const levels = getSortedLevels(normalizedLevels);
  const activeOverlayWidthClassName = overlayWidthClassName ?? levels[0]?.widthClassName ?? "w-56";

  const [viewportWidth, setViewportWidth] = useState<number>(getInitialViewportWidth);
  const [inlineSidebarOpen, setInlineSidebarOpen] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const activeLevel = resolveLevel(viewportWidth, levels);
  const isOverlayMode = type === "resizable" && activeLevel === null;

  const isIconMode = activeLevel?.iconMode ?? false;

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (type === "fixed") {
      setInlineSidebarOpen(true);
      setOverlayOpen(false);
      return;
    }

    if (!isOverlayMode) {
      setOverlayOpen(false);
    }
  }, [isOverlayMode, type]);

  function renderSidebarChildren(iconMode: boolean) {
    if (typeof children === "function") {
      return children({ iconMode });
    }
    return children;
  }

  if (type === "fixed") {
    return (
      <SidebarProvider open>
        <UISidebar
          collapsible="none"
          className={`h-[100dvh] ${fixedWidthClassName} border-r border-slate-200 px-2 py-3 dark:border-slate-800`}
        >
          {renderSidebarChildren(false)}
        </UISidebar>
      </SidebarProvider>
    );
  }

  const inlineSidebar = (
    <SidebarProvider open={inlineSidebarOpen} onOpenChange={setInlineSidebarOpen}>
      <UISidebar
        collapsible="icon"
        className={
          inlineSidebarOpen
            ? `h-[100dvh] ${activeLevel?.widthClassName ?? "w-56"} border-r border-slate-200 px-2 py-3 transition-[width,padding] duration-200 dark:border-slate-800 ${isIconMode ? "px-1 py-2" : ""}`
            : "h-[100dvh] w-0 border-r border-slate-200 px-0 py-0 transition-[width,padding] duration-200 dark:border-slate-800"
        }
      >
        {inlineSidebarOpen ? renderSidebarChildren(isIconMode) : null}
        <SidebarRail
          onClick={(event) => {
            event.preventDefault();
            setInlineSidebarOpen((current) => !current);
          }}
        />
      </UISidebar>
    </SidebarProvider>
  );

  if (isOverlayMode) {
    return (
      <>
        <SidebarProvider open={false} onOpenChange={() => {}}>
          <UISidebar collapsible="icon" className="h-[100dvh] w-0 border-r border-slate-200 px-0 py-0 dark:border-slate-800">
            {!overlayOpen ? (
              <SidebarRail
                className="fixed left-0 right-auto z-[70] -translate-x-1/2"
                onClick={(event) => {
                  event.preventDefault();
                  setOverlayOpen(true);
                }}
              />
            ) : null}
          </UISidebar>
        </SidebarProvider>

        <Sheet open={overlayOpen} onOpenChange={setOverlayOpen}>
          <SheetContent side="left" className={`${activeOverlayWidthClassName} max-w-none overflow-visible border-r border-slate-200 p-0 dark:border-slate-800`} showCloseButton>
            <SidebarProvider open>
              <UISidebar collapsible="none" className="h-full w-full box-border overflow-y-auto overflow-x-hidden px-2 py-3">
                {renderSidebarChildren(false)}
              </UISidebar>
              <SidebarRail
                className="left-auto right-0 z-[80] translate-x-1/2"
                onClick={(event) => {
                  event.preventDefault();
                  setOverlayOpen(false);
                }}
              />
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return inlineSidebar;
}
