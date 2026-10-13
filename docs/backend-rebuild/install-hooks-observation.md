# DSH 原生安装钩子观察

2026-10-13。仅使用临时 DSH_HOME/profile、无网络依赖的本地 tarball；未修改实际 Web profile、凭据或容器。DSH 0.1.5-rc.2，pnpm 11.23.0。

DSH plugin 管理器转发参数到 pnpm，只有 pnpm 成功后才 reconcile 插件 bundles；无自定义安装前/安装后的服务钩子，也无失败事务回退。依赖包仍有 pnpm preinstall/postinstall 生命周期。

| 输入 | 观察 |
| --- | --- |
| 未授权生命周期脚本 | add exit 1；无钩子执行；依赖、包和锁文件仍可能存在；未登记 bundle |
| 精确授权 tarball，preinstall exit 23 | 钩子运行时包和锁文件已经存在，依赖还未保存；add exit 23，未登记 bundle；包和锁文件仍存在 |
| 精确授权 tarball，postinstall exit 23 | pre/post 均执行；同样非零退出且未登记 bundle；包和锁文件仍存在 |
| 精确授权，pre/post 正常 | add exit 0；返回后依赖保存、bundle 登记；随后独立 plugin remove 成功去除依赖/包/bundle，但锁文件仍存在 |
| postinstall 内同步调用 plugin remove 自身 | 内部 remove exit 1：此时 profile 尚未保存依赖，报 CANNOT_REMOVE_MISSING_DEPS；外层 add 最终 exit 0，插件仍登记 |

结论：可以利用 pnpm 的 preinstall 检查环境并阻断成功，postinstall 可以承担初始化；须显式授权准确包身份且不能使用 ignore-scripts。preinstall 不等于所有文件变更之前，非零退出不等于事务回退。postinstall 仍在 add 过程中，不是 add 完成后的钩子，不能依赖其中的自卸载完成回滚。若要求 profile/服务恢复安装前状态，需由安装调用方在 pnpm 结束后做有边界的清理及快照恢复；上游 DSH 目前不会代为完成。普通 remove 成功只证明正常卸载，不证明恢复安装前全部文件。

首轮探针将包名授权用于本地 tarball，遭遇身份不匹配；随后按精确 file 引用授权重测，报告使用最终结果。探针第一次误把 offline 参数传给 remove，已按该子命令支持的参数修正；没有将探针错误当作产品缺陷。

证据：artifacts/backend-rebuild/install-hooks/results.json、probe.mjs 和各模式日志。


后续：安装失败回退、正常卸载与重装的九场景实测已完成，见 [回退实验报告](install-rollback-results.md)。原生包管理不能自动清掉全部失败残余；配置/依赖快照和自有服务资源补偿层在隔离环境验证通过，尚非正式安装器交付。
