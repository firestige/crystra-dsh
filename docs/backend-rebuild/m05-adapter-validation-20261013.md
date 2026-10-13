# M05：审批与 UI Adapter 收口验证

范围只覆盖共识审批对 DSH 的两处适配，不引入通用插件框架，不改变审批状态机、共识权限或差异算法。

## 边界

- `dsh-approval-adapter.js` 接收结构化 presentation，负责原生审批调用、可读 reason 编码、审核事件关联与持久化 flush；返回 `{outcome, approvalEvidence?}`。审批领域不再编码文本，也不读取 DSH 原生事件。入口通过该 Adapter 注册原有投影。
- `consensus-approval-client.js` 的 `createDshUiAdapter` 集中处理宿主 hook、slot、侧栏和 DOM 适配。正文、左右对比与单页审阅组件仅接收展示数据和回调。继续使用 DSH 的单一浏览器入口，不为文件拆分增加新的加载框架。

## 失败行为

审批服务缺失、调用失败、缺少本次审核事件或 flush 失败，均返回 unavailable；当前请求拒绝，不发布、不切换。用户新的指示可在同一会话发起新 operationId。不能拿之前相同 callId 的批准充作本次证据。

增强界面缺失、投影出错或侧栏同步/异步打开失败时，保留或恢复 DSH 原生完整正文和审批按钮。只在确认当前 DOM 元素恰是本次原生 reason、并且详情面板可用时收起重复正文；宿主 DOM 结构变化、卡片卸载或面板适配失效时恢复原样。不会用宽泛的 first-child CSS 隐藏未知元素。

这不是对底层存储持续不可用或 DSH 自身整体故障的恢复承诺；持久化安全边界维持原设计。

## 旧记录

审批领域日志仍为原 schemaVersion 1，不重写历史；现有 awaiting 中断处理、已发布恢复和 switching 回执继续沿用。保留旧版原生 reason 解码、旧结构化详情 DTO 的语义归一化，投影 key 和 stateVersion 沿用现值。新记录只写 DSH 已知审批事件。

新增测试用全新 JSONL 宿主读取旧版原生审批文本，核对前后正文并在匹配决定后清空；既有旧 DTO 投影与审批发布中断恢复测试继续通过。旧 DTO 投影兼容不表示修复含未知 required 事件的非法 DSH 日志。

## 验证

完整 `npm test`：463 passed，0 failed，0 skipped。

替身测试覆盖结构化领域接口、审核证据、旧决定不可复用、服务缺失、调用抛错、flush 失败、宿主 hook/slot 缺失、侧栏同步/异步失败、面板投影失败及卡片卸载恢复。真实 DSH ApprovalService 也验证了 flush 失败后，同一 Session 可重新申请成功。

真实 DSH 0.1.5-rc.2 Web：独立安装包通过原生 plugin add 安装到隔离 profile；使用真实 Squidex、原生审批按钮、持久日志和 Web UI。离线模型驱动负责产生工具调用，没有调用付费模型。

同一个 `adapter-DRAFT2` 会话中：首次发布拒绝后重新批准并完成；更新最终安装包后再次发起版本审批，模拟宿主 DOM 结构变化，确认完整原生正文恢复且按钮可用；拒绝后在原会话重新批准，版本切换 completed；随后正常声明并执行文件检查，最终 GO、active=null、pending=0、turn/end completed。全程未修改审批或 Barrier 状态。

DOM 变化属于显式适配故障模拟，不声称发现 DSH 当前版本的用户可达缺陷。测试驱动曾遗漏步骤声明和 probe.txt 输入，导致正确的 NO_GO；补入正常声明和文件输入并重跑后闭合，没有以改状态掩盖测试错误。

脱敏证据、最终包及源码 hash：`artifacts/backend-rebuild/m05-adapters-20261013/`。测试 Web 已停止，隔离容器和测试数据清理；日常 profile、模型、UI、局域网配置及凭据未改动。
