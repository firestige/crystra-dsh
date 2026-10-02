import { Badge } from "crystra-ui-core";
import "./workbench-attention.css";
/** Crystra owns notification meaning, count policy, and motion. */
export function WorkbenchAttentionBadge({
  changed,
  unreadCount,
}: {
  changed: boolean;
  unreadCount: number;
}) {
  const count =
    Number.isSafeInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  if (!changed && !count) return null;
  const label = [
    changed ? "内容有更新" : null,
    count ? `${count} 条未读通知` : null,
  ]
    .filter(Boolean)
    .join("，");
  return (
    <Badge
      role="img"
      aria-label={label}
      title={label}
      dot={!count}
      className="crystra-workbench-attention"
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}
