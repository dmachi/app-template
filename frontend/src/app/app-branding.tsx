export function isImageIconSource(iconValue: string): boolean {
  const normalized = (iconValue || "").trim().toLowerCase();
  return normalized.startsWith("/") || normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("data:image/");
}

export function renderAppIcon(iconValue: string) {
  if (isImageIconSource(iconValue)) {
    return <img src={iconValue} alt="" className="h-6 w-6 object-contain" />;
  }
  return <span>{iconValue || "🧩"}</span>;
}