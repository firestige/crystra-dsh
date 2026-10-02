import { createContext } from "react";
import type { WorkbenchStore } from "./workbench-store";
export const WorkbenchContext = createContext<WorkbenchStore | null>(null);
