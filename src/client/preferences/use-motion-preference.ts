import { useSyncExternalStore } from "react";
const key = "crystra.preferences.execution-motion";
const event = "crystra:motion-preference";
function read() {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}
function subscribe(changed: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) changed();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(event, changed);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(event, changed);
  };
}
/** Host display preference, shared by same-origin windows; not an Execution setting. */
export function useMotionPreference() {
  const enabled = useSyncExternalStore(subscribe, read, () => true);
  const setEnabled = (value: boolean) => {
    localStorage.setItem(key, value ? "on" : "off");
    window.dispatchEvent(new Event(event));
  };
  return { enabled, setEnabled };
}
