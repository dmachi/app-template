import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  children,
  ...props
}: PopoverPrimitive.PopoverContentProps & { children: ReactNode }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-80 rounded-md border border-slate-200 bg-white p-2 text-slate-950 shadow-md outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
