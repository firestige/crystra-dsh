import { useState } from "react";
import { Typography, ToggleSwitch } from "crystra-ui-core";
import { useMotionPreference } from "./use-motion-preference";
export function DisplaySettings() {
  const { enabled, setEnabled } = useMotionPreference();
  const [error, setError] = useState("");
  return (
    <section>
      <Typography as="h3" variant="section-title">
        显示
      </Typography>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          marginTop: 24,
        }}
      >
        <div>
          <Typography as="h4" variant="item-title">
            执行动效
          </Typography>
          <Typography as="p" variant="description">
            显示执行路径流动与节点光晕。关闭后保留状态与路径；始终遵循系统的减少动态效果设置。
          </Typography>
        </div>
        <ToggleSwitch
          label="执行动效"
          checked={enabled}
          onCheckedChange={(value) => {
            try {
              setEnabled(value);
              setError("");
            } catch {
              setError("无法保存显示偏好，请检查浏览器存储权限。");
            }
          }}
        />
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
