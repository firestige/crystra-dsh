import { useMotionPreference } from "../preferences/use-motion-preference";
import { WorkflowMapReadonly } from "crystra-ui-core";
import type { ExecutionMapProps } from "crystra-ui-core";
import "./execution-map.css";
/** Business motion is composed here; the UI engine only supplies geometry. */
export function ExecutionMap({
  motion,
  effectsEnabled = true,
  ...props
}: ExecutionMapProps) {
  const { enabled } = useMotionPreference();
  return (
    <WorkflowMapReadonly
      {...props}
      renderOverlay={(layout) => {
        if (!motion) return null;
        const node = layout.nodes.find((n) => n.id === motion.nodeId);
        return (
          <g
            className="crystra-execution-motion"
            data-pace={motion.pace}
            data-effects={effectsEnabled && enabled ? "on" : "off"}
            aria-hidden="true"
            pointerEvents="none"
          >
            {layout.edges
              .filter((e) => motion.edgeIds.includes(e.id))
              .map((e) => (
                <g key={e.segmentKey ?? e.id}>
                  <path className="execution-active-edge" d={e.path} />
                  {motion.pace !== "error" && (
                    <path className="execution-flow-sweep" d={e.path} />
                  )}
                </g>
              ))}
            {node && (
              <rect
                className="execution-node-halo"
                x={node.x - 5}
                y={node.y - 5}
                width={node.width + 10}
                height={node.height + 10}
                rx={16}
              />
            )}
          </g>
        );
      }}
    />
  );
}
