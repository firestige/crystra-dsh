import React from "react";
import * as Primitives from "@deepseek-ai/dsh-client-ui-primitives";
import {
  BiSurface,
  Button,
  ButtonGroup,
  CATALOG_COORDINATES,
  CompareResultFrame,
  DashboardMetricPanel,
  EvidenceConsoleFoundation,
  MetricPanel,
  ReceiptView,
  ScopedError,
  StatusBadge,
  Surface,
  TextInput,
  TraceStatistics,
  TraceTree,
  TraceWaterfall,
  Typography,
  compileTraceView,
  createBiTheme,
  selectDefaultVisualizer,
} from "crystra-ui-core";
import sharedStyles from "crystra-ui-core/styles.css";

import { createStudioClientPlugin } from "./studio.js";

const Bi = Object.freeze({
  BiSurface,
  Button,
  ButtonGroup,
  CATALOG_COORDINATES,
  CompareResultFrame,
  DashboardMetricPanel,
  EvidenceConsoleFoundation,
  MetricPanel,
  ReceiptView,
  ScopedError,
  StatusBadge,
  Surface,
  TextInput,
  TraceStatistics,
  TraceTree,
  TraceWaterfall,
  Typography,
  compileTraceView,
  createBiTheme,
  selectDefaultVisualizer,
});

const plugin = createStudioClientPlugin({ React, Primitives, Bi, sharedStyles });
export const name = plugin.name;
export const inject = plugin.inject;
export const apply = plugin.apply;
