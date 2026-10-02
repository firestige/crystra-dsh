import { defineStore } from "@deepseek-ai/dsh-client-store";
/** Host presentation state only; switching never changes Task, Session or route identity. */
export function createSurfaceModeStore() {
  return defineStore({
    init: (): { surface: "crystra" | "harness" } => ({ surface: "crystra" }),
    actions: {
      show(
        state: { surface: "crystra" | "harness" },
        surface: "crystra" | "harness",
      ) {
        state.surface = surface;
      },
    },
  }).create();
}
