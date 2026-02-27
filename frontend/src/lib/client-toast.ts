export type ClientToastSeverity = "info" | "success" | "warning" | "error";

export type ClientToastEventDetail = {
  title?: string;
  message: string;
  severity?: ClientToastSeverity;
};

export const CLIENT_TOAST_EVENT = "bst:client-toast";

export function showClientToast(detail: ClientToastEventDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ClientToastEventDetail>(CLIENT_TOAST_EVENT, { detail }));
}
