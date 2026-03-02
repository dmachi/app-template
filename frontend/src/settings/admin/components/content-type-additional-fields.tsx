import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { CmsFieldDefinition, MediaImageItem } from "../../../lib/api";

type AdditionalFieldsMap = Record<string, unknown>;

type SelectOption = {
  label: string;
  value: string;
};

type LinkItem = {
  label: string;
  url: string;
};

type ContentTypeAdditionalFieldsProps = {
  fieldDefinitions: CmsFieldDefinition[];
  value: AdditionalFieldsMap;
  onChange: (nextValue: AdditionalFieldsMap) => void;
  mediaItems: MediaImageItem[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function asLink(value: unknown): LinkItem {
  const record = asRecord(value);
  if (!record) {
    return { label: "", url: "" };
  }
  return {
    label: asString(record.label),
    url: asString(record.url),
  };
}

function asLinks(value: unknown): LinkItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => asLink(item));
}

function optionFromUnknown(option: unknown): SelectOption | null {
  if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
    const normalized = String(option);
    return { label: normalized, value: normalized };
  }
  const record = asRecord(option);
  if (!record || !("value" in record)) {
    return null;
  }
  const rawValue = record.value;
  if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
    return null;
  }
  const value = String(rawValue);
  const label = typeof record.label === "string" && record.label.trim() ? record.label : value;
  return { label, value };
}

function extractSelectOptions(definition: CmsFieldDefinition): SelectOption[] {
  const optionsFromDefinition = Array.isArray(definition.options) ? definition.options : [];
  const options = optionsFromDefinition.map(optionFromUnknown).filter((item): item is SelectOption => item !== null);
  if (options.length > 0) {
    return options;
  }

  const validationRecord = asRecord(definition.validation);
  const allowedValues = Array.isArray(validationRecord?.allowedValues)
    ? validationRecord.allowedValues
    : Array.isArray(validationRecord?.options)
      ? validationRecord.options
      : [];

  return allowedValues.map(optionFromUnknown).filter((item): item is SelectOption => item !== null);
}

function setFieldValue(current: AdditionalFieldsMap, key: string, nextValue: unknown): AdditionalFieldsMap {
  return {
    ...current,
    [key]: nextValue,
  };
}

function renderHelp(definition: CmsFieldDefinition) {
  if (!definition.helpText && !definition.description) {
    return null;
  }
  const text = definition.helpText || definition.description;
  return <span className="text-xs text-slate-500 dark:text-slate-400">{text}</span>;
}

export function ContentTypeAdditionalFields({
  fieldDefinitions,
  value,
  onChange,
  mediaItems,
}: ContentTypeAdditionalFieldsProps) {
  if (!fieldDefinitions.length) {
    return null;
  }

  return (
    <>
      {fieldDefinitions.map((definition) => {
          const key = definition.key;
          const label = definition.required ? `${definition.label} *` : definition.label;
          const currentValue = value[key];
          const type = definition.type;

          if (type === "boolean") {
            return (
              <label key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(currentValue)}
                    onChange={(event) => onChange(setFieldValue(value, key, event.target.checked))}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Enabled</span>
                </div>
                {renderHelp(definition)}
              </label>
            );
          }

          if (type === "number") {
            return (
              <label key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <Input
                  type="number"
                  value={typeof currentValue === "number" ? String(currentValue) : asString(currentValue)}
                  placeholder={definition.placeholder}
                  onChange={(event) => {
                    const nextRawValue = event.target.value;
                    if (!nextRawValue.trim()) {
                      onChange(setFieldValue(value, key, null));
                      return;
                    }
                    const numeric = Number(nextRawValue);
                    onChange(setFieldValue(value, key, Number.isNaN(numeric) ? null : numeric));
                  }}
                />
                {renderHelp(definition)}
              </label>
            );
          }

          if (type === "textarea" || type === "markdown") {
            return (
              <label key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={asString(currentValue)}
                  placeholder={definition.placeholder}
                  onChange={(event) => onChange(setFieldValue(value, key, event.target.value))}
                />
                {renderHelp(definition)}
              </label>
            );
          }

          if (type === "select") {
            const options = extractSelectOptions(definition);
            return (
              <label key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={asString(currentValue)}
                  onChange={(event) => onChange(setFieldValue(value, key, event.target.value))}
                >
                  <option value="">Select...</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {renderHelp(definition)}
              </label>
            );
          }

          if (type === "multiselect") {
            const options = extractSelectOptions(definition);
            const selected = asStringArray(currentValue);
            return (
              <label key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <select
                  multiple
                  className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={selected}
                  onChange={(event) => {
                    const nextValues = Array.from(event.target.selectedOptions).map((option) => option.value);
                    onChange(setFieldValue(value, key, nextValues));
                  }}
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {renderHelp(definition)}
              </label>
            );
          }

          if (type === "link") {
            const currentLink = asLink(currentValue);
            return (
              <div key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={currentLink.label}
                    placeholder="Label"
                    onChange={(event) => onChange(setFieldValue(value, key, { ...currentLink, label: event.target.value }))}
                  />
                  <Input
                    value={currentLink.url}
                    placeholder="https://..."
                    onChange={(event) => onChange(setFieldValue(value, key, { ...currentLink, url: event.target.value }))}
                  />
                </div>
                {renderHelp(definition)}
              </div>
            );
          }

          if (type === "links") {
            const links = asLinks(currentValue);
            return (
              <div key={key} className="grid gap-2 text-sm">
                <span>{label}</span>
                <div className="grid gap-2">
                  {links.map((link, index) => (
                    <div key={`${key}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <Input
                        value={link.label}
                        placeholder="Label"
                        onChange={(event) => {
                          const nextLinks = [...links];
                          nextLinks[index] = { ...nextLinks[index], label: event.target.value };
                          onChange(setFieldValue(value, key, nextLinks));
                        }}
                      />
                      <Input
                        value={link.url}
                        placeholder="https://..."
                        onChange={(event) => {
                          const nextLinks = [...links];
                          nextLinks[index] = { ...nextLinks[index], url: event.target.value };
                          onChange(setFieldValue(value, key, nextLinks));
                        }}
                      />
                      <Button
                        type="button"
                        className="bg-transparent"
                        onClick={() => {
                          const nextLinks = links.filter((_, currentIndex) => currentIndex !== index);
                          onChange(setFieldValue(value, key, nextLinks));
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div>
                  <Button
                    type="button"
                    className="bg-transparent"
                    onClick={() => onChange(setFieldValue(value, key, [...links, { label: "", url: "" }]))}
                  >
                    Add Link
                  </Button>
                </div>
                {renderHelp(definition)}
              </div>
            );
          }

          if (type === "imageRef") {
            return (
              <label key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={asString(currentValue)}
                  onChange={(event) => onChange(setFieldValue(value, key, event.target.value))}
                >
                  <option value="">None</option>
                  {mediaItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.filename}
                    </option>
                  ))}
                </select>
                {renderHelp(definition)}
              </label>
            );
          }

          if (type === "imageRefs") {
            const selected = new Set(asStringArray(currentValue));
            return (
              <div key={key} className="grid gap-1 text-sm">
                <span>{label}</span>
                <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  {mediaItems.map((item) => {
                    const checked = selected.has(item.id);
                    return (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = new Set(selected);
                            if (event.target.checked) {
                              next.add(item.id);
                            } else {
                              next.delete(item.id);
                            }
                            onChange(setFieldValue(value, key, Array.from(next)));
                          }}
                        />
                        <span>{item.filename}</span>
                      </label>
                    );
                  })}
                  {mediaItems.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">No media items available.</p> : null}
                </div>
                {renderHelp(definition)}
              </div>
            );
          }

          const inputType = type === "url" ? "url" : type === "date" ? "date" : type === "datetime" ? "datetime-local" : "text";
          return (
            <label key={key} className="grid gap-1 text-sm">
              <span>{label}</span>
              <Input
                type={inputType}
                value={asString(currentValue)}
                placeholder={definition.placeholder}
                onChange={(event) => onChange(setFieldValue(value, key, event.target.value))}
              />
              {renderHelp(definition)}
            </label>
          );
        })}
    </>
  );
}
