import type { ReactNode } from "react";

import type { AppHeaderVariant } from "../components/app-header";

export type AppHeaderPathVariantMap = Record<string, AppHeaderVariant>;

export const APP_HEADER_PATH_VARIANTS: AppHeaderPathVariantMap = {
  "/": {
    classNames: [
      "min-h-content",
      "bg-gradient-to-br",
      "from-slate-300",
      "via-slate-100",
      "to-white",
      "dark:from-slate-700",
      "dark:via-slate-900",
      "dark:to-slate-950",
      "shadow-inner",
    ],
    bottomContent: (
      <div className="w-full mx-auto">
        <div className="text-4xl text-center uppercase m-14 text-slate-600 dark:text-slate-300">
          Lorem ipsum dolor sit amet consectetur adipisicing elit.
        </div>
      </div>
    ),
  },
};

function getRegexForVariantKey(key: string): RegExp | null {
  if (key.startsWith("re:")) {
    return new RegExp(key.slice(3));
  }

  if (key.startsWith("/^")) {
    const lastSlashIndex = key.lastIndexOf("/");
    if (lastSlashIndex > 0) {
      const pattern = key.slice(1, lastSlashIndex);
      const flags = key.slice(lastSlashIndex + 1);
      return new RegExp(pattern, flags);
    }
  }

  return null;
}

export function resolveAppHeaderPathVariant(pathname: string, pathVariants: AppHeaderPathVariantMap = APP_HEADER_PATH_VARIANTS): AppHeaderVariant | undefined {
  if (pathVariants[pathname]) {
    return pathVariants[pathname];
  }

  for (const [key, variant] of Object.entries(pathVariants)) {
    const regex = getRegexForVariantKey(key);
    if (regex && regex.test(pathname)) {
      return variant;
    }
  }

  return undefined;
}
