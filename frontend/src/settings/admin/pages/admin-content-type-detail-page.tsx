import { useEffect, useState } from "react";
import { useMatchRoute } from "@tanstack/react-router";

import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { showClientToast } from "../../../lib/client-toast";
import {
  adminPatchCmsContentType,
  listCmsContentTypes,
  type CmsContentType,
  type CmsFieldDefinition,
} from "../../../lib/api";

const FIELD_TYPE_OPTIONS = [
  "text",
  "textarea",
  "markdown",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "multiselect",
  "url",
  "link",
  "links",
  "imageRef",
  "imageRefs",
];

function parseOptionsText(raw: string): Array<string | number | boolean> {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((value) => {
      if (value === "true") {
        return true;
      }
      if (value === "false") {
        return false;
      }
      const numberValue = Number(value);
      if (!Number.isNaN(numberValue) && value !== "") {
        return numberValue;
      }
      return value;
    });
}

function optionsToText(options: CmsFieldDefinition["options"]): string {
  if (!Array.isArray(options) || options.length === 0) {
    return "";
  }
  return options
    .map((option) => {
      if (typeof option === "object" && option !== null && "value" in option) {
        return String(option.value);
      }
      return String(option);
    })
    .join(", ");
}

export default function AdminContentTypeDetailRoutePage() {
  const routeContext = useAppRouteRenderContext();
  const accessToken = routeContext.settingsProps.accessToken;
  const canManageTypes = routeContext.settingsProps.adminCapabilities.contentTypes;

  const matchRoute = useMatchRoute() as (options: { to: string; fuzzy?: boolean }) => Record<string, string> | false;
  const match = matchRoute({ to: "/settings/admin/content-types/$contentTypeKey", fuzzy: false }) as { contentTypeKey?: string } | false;
  const contentTypeKey = (match && match.contentTypeKey) || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<CmsContentType | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [fieldDefinitions, setFieldDefinitions] = useState<CmsFieldDefinition[]>([]);
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);

  // Core fields that are always present
  const coreFields: CmsFieldDefinition[] = [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "content", label: "Content", type: "markdown", required: true },
  ];

  useEffect(() => {
    if (!routeContext.isAuthenticated || !contentTypeKey) {
      return;
    }

    setLoading(true);
    listCmsContentTypes()
      .then((payload) => {
        const found = (payload.items || []).find((entry) => entry.key === contentTypeKey) || null;
        if (!found) {
          setItem(null);
          return;
        }
        setItem(found);
        setLabel(found.label || "");
        setDescription(found.description || "");
        setFieldDefinitions(Array.isArray(found.fieldDefinitions) ? found.fieldDefinitions : []);
        // Initialize field order with core fields first, then custom fields
        const customFieldKeys = (found.fieldDefinitions || []).map(f => f.key);
        const initialOrder = found.fieldOrder && found.fieldOrder.length > 0
          ? found.fieldOrder
          : ["name", "content", ...customFieldKeys];
        setFieldOrder(initialOrder);
      })
      .catch((error) => {
        showClientToast({ title: "Content Types", message: error instanceof Error ? error.message : "Unable to load content type", severity: "error" });
      })
      .finally(() => setLoading(false));
  }, [contentTypeKey, routeContext.isAuthenticated]);

  function addField() {
    const newFieldKey = `field_${Date.now()}`;
    setFieldDefinitions((current) => [
      ...current,
      { key: newFieldKey, label: "", type: "text", required: false, placeholder: "", helpText: "" },
    ]);
    setFieldOrder((current) => [...current, newFieldKey]);
  }

  function removeField(fieldKey: string) {
    setFieldDefinitions((current) => current.filter((field) => field.key !== fieldKey));
    setFieldOrder((current) => current.filter((key) => key !== fieldKey));
  }

  function moveFieldUp(fieldKey: string) {
    setFieldOrder((current) => {
      const index = current.indexOf(fieldKey);
      if (index <= 0) return current;
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveFieldDown(fieldKey: string) {
    setFieldOrder((current) => {
      const index = current.indexOf(fieldKey);
      if (index < 0 || index >= current.length - 1) return current;
      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function updateField(fieldKey: string, patch: Partial<CmsFieldDefinition>) {
    setFieldDefinitions((current) =>
      current.map((field) => {
        if (field.key !== fieldKey) {
          return field;
        }
        const updated = { ...field, ...patch };
        // If the key changed, update fieldOrder as well
        if (patch.key && patch.key !== fieldKey) {
          setFieldOrder((order) => order.map((k) => (k === fieldKey ? patch.key! : k)));
        }
        return updated;
      }),
    );
  }

  async function saveDefinition() {
    if (!contentTypeKey || !canManageTypes) {
      return;
    }
    if (!label.trim()) {
      showClientToast({ title: "Content Types", message: "Name is required", severity: "error" });
      return;
    }

    for (const field of fieldDefinitions) {
      if (!field.key?.trim() || !field.label?.trim() || !field.type?.toString().trim()) {
        showClientToast({
          title: "Content Types",
          message: "Each field requires key, label, and type",
          severity: "error",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await adminPatchCmsContentType(accessToken, contentTypeKey, {
        label: label.trim(),
        description: description.trim() || null,
        fieldDefinitions,
        fieldOrder,
      });
      setItem(updated);
      setLabel(updated.label || "");
      setDescription(updated.description || "");
      setFieldDefinitions(Array.isArray(updated.fieldDefinitions) ? updated.fieldDefinitions : []);
      const customFieldKeys = (updated.fieldDefinitions || []).map(f => f.key);
      const updatedOrder = updated.fieldOrder && updated.fieldOrder.length > 0
        ? updated.fieldOrder
        : ["name", "content", ...customFieldKeys];
      setFieldOrder(updatedOrder);
      showClientToast({ title: "Content Types", message: "Definition saved", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content Types", message: error instanceof Error ? error.message : "Unable to save definition", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!routeContext.isAuthenticated || !contentTypeKey) {
    return null;
  }

  if (loading) {
    return <p className="text-sm">Loading content type...</p>;
  }

  if (!item) {
    return (
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Content Type</h2>
          <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo("/settings/admin/content-types")}>Back to Content Types</Button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">Content type not found.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{item.label}</h2>
        <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo("/settings/admin/content-types")}>Back to Content Types</Button>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} disabled={!canManageTypes} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Key</span>
            <Input value={item.key} disabled />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Description</span>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canManageTypes} />
        </label>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fields</p>
          {canManageTypes ? (
            <Button type="button" className="bg-transparent" onClick={addField}>Add Field</Button>
          ) : null}
        </div>

        {fieldOrder.map((fieldKey, orderIndex) => {
          const coreField = coreFields.find((f) => f.key === fieldKey);
          const customField = fieldDefinitions.find((f) => f.key === fieldKey);
          const field = coreField || customField;
          
          if (!field) return null;
          
          const isCore = Boolean(coreField);
          const canMoveUp = orderIndex > 0;
          const canMoveDown = orderIndex < fieldOrder.length - 1;

          return (
            <div
              key={`${item.key}-field-${fieldKey}`}
              className={`grid gap-2 rounded-md border p-2 ${
                isCore
                  ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              {isCore ? (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Core Field (cannot be removed)
                </div>
              ) : null}
              
              <div className="grid gap-2 md:grid-cols-4">
                <Input
                  placeholder="key"
                  value={field.key || ""}
                  onChange={(event) => !isCore && updateField(fieldKey, { key: event.target.value })}
                  disabled={!canManageTypes || isCore}
                />
                <Input
                  placeholder="label"
                  value={field.label || ""}
                  onChange={(event) => !isCore && updateField(fieldKey, { label: event.target.value })}
                  disabled={!canManageTypes || isCore}
                />
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={String(field.type || "text")}
                  onChange={(event) => !isCore && updateField(fieldKey, { type: event.target.value })}
                  disabled={!canManageTypes || isCore}
                >
                  {FIELD_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    onChange={(event) => !isCore && updateField(fieldKey, { required: event.target.checked })}
                    disabled={!canManageTypes || isCore}
                  />
                  Required
                </label>
              </div>
              
              {!isCore ? (
                <>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      placeholder="placeholder (optional)"
                      value={field.placeholder || ""}
                      onChange={(event) => updateField(fieldKey, { placeholder: event.target.value })}
                      disabled={!canManageTypes}
                    />
                    <Input
                      placeholder="help text (optional)"
                      value={field.helpText || ""}
                      onChange={(event) => updateField(fieldKey, { helpText: event.target.value })}
                      disabled={!canManageTypes}
                    />
                  </div>
                  {field.type === "select" || field.type === "multiselect" ? (
                    <Input
                      placeholder="options (comma-separated)"
                      value={optionsToText(field.options)}
                      onChange={(event) => updateField(fieldKey, { options: parseOptionsText(event.target.value) })}
                      disabled={!canManageTypes}
                    />
                  ) : null}
                </>
              ) : null}
              
              {canManageTypes ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    className="bg-transparent"
                    onClick={() => moveFieldUp(fieldKey)}
                    disabled={!canMoveUp}
                  >
                    ↑ Move Up
                  </Button>
                  <Button
                    type="button"
                    className="bg-transparent"
                    onClick={() => moveFieldDown(fieldKey)}
                    disabled={!canMoveDown}
                  >
                    ↓ Move Down
                  </Button>
                  {!isCore ? (
                    <Button type="button" className="bg-transparent" onClick={() => removeField(fieldKey)}>
                      Remove Field
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {fieldOrder.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No fields configured.</p> : null}

        {canManageTypes ? (
          <div>
            <Button type="button" onClick={() => void saveDefinition()} disabled={saving}>
              {saving ? "Saving..." : "Save Definition"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
