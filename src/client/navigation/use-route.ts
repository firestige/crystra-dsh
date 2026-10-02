import { useSyncExternalStore } from "react";
import { resolveRoute } from "./routes.js";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange",listener);
  return () => {window.removeEventListener("popstate", listener);window.removeEventListener("hashchange",listener);};
}
export function navigate(href: string, hostRoot = false) {
  if(hostRoot)href="/#"+href;
  if (window.location.pathname + window.location.search + window.location.hash === href) return;
  window.history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function useRoute() {
  return resolveRoute(
    useSyncExternalStore(
      subscribe,
      () => window.location.pathname + window.location.search + window.location.hash,
    ),
  );
}
