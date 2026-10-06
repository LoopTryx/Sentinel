import { invoke } from "@tauri-apps/api/core";

/**
 * Backend availability probe. The console renders its honest preview content
 * when no Tauri runtime exists (plain browser / static preview) and flips to
 * live mode only when the desktop shell actually answers a command. Nothing
 * fakes success in either mode.
 */
export function hasBackend(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function backendInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!hasBackend()) {
    return Promise.reject(new Error("backend-unavailable"));
  }
  return invoke<T>(cmd, args);
}
