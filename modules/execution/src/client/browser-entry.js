import React from "react";
import { Button, DisclosureRow, IconCheckOutline16, IconCopyOutline16, JsonTree, MessageText, Pill, StateDot, Tooltip, writeClipboard } from "@deepseek-ai/dsh-client-ui-primitives";
import * as workspaceUi from "@deepseek-ai/dsh-client-ui-workspace";

import { createCrystraCommandView, registerActionPresentation } from "../action-presentation/view.js";
import { createDeliveryControlPlaneClient } from "./delivery/control-plane-port.js";
import { registerSessionDeliveryView } from "./delivery/session-delivery-view.js";

export const name = "crystra-execution-client";
export const inject = Object.freeze([
  "connection", ...workspaceUi.inject,
]);

export function apply(ctx, options = {}) {
  const controlPlane = createDeliveryControlPlaneClient(ctx.connection.rpc);
  const refresh = () => { void controlPlane.refresh(); };
  refresh();
  const timer = setInterval(refresh, 2_000);
  ctx.effect(() => () => clearInterval(timer), "crystra-execution: control-plane refresh");

  options.registerTaskWorkbench?.(ctx, controlPlane);
  if (options.registerProductShell) {
    workspaceUi.apply(ctx);
    options.registerProductShell(ctx, controlPlane);
  }
  registerSessionDeliveryView(ctx, {
    React,
    Button,
    DisclosureRow,
    IconCheckOutline16,
    IconCopyOutline16,
    Pill,
    StateDot,
    Tooltip,
    writeClipboard,
    bindProjection(sessionId) {
      const source = controlPlane.bindSession(String(sessionId));
      void source.refresh();
      return source;
    },
  });
  registerActionPresentation(ctx, createCrystraCommandView({
    React,
    DisclosureRow,
    IconCheckOutline16,
    IconCopyOutline16,
    JsonTree,
    MessageText,
    StateDot,
    Tooltip,
    writeClipboard,
    inventory: controlPlane.inventory,
  }));
}
