import { useState } from "react";
import type { ProfilePropertyLinkItem } from "../../lib/api";

export function getProfilePropertyLinkItems(registerProfileProperties: Record<string, unknown>, key: string): ProfilePropertyLinkItem[] {
  const value = registerProfileProperties[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is ProfilePropertyLinkItem => Boolean(item) && typeof item === "object" && "label" in item && "url" in item)
    .map((item) => ({ label: String(item.label ?? ""), url: String(item.url ?? "") }));
}

export function useAppAuthFormState() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerProfileProperties, setRegisterProfileProperties] = useState<Record<string, unknown>>({});

  return {
    usernameOrEmail,
    setUsernameOrEmail,
    password,
    setPassword,
    registerUsername,
    setRegisterUsername,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    registerDisplayName,
    setRegisterDisplayName,
    registerProfileProperties,
    setRegisterProfileProperties,
  };
}