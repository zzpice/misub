# 数据模型

Zzp Sub 的个人实例继续使用现有 D1 与辅助 KV。绑定名和持久化键标识沿用已部署值，不新增命名回退或双写层。

## D1

- `subscriptions(id, data, created_at, updated_at)`：每行一个远程订阅或手动节点。JSON 包含 `id`、`name`、`url`、`enabled`、排序/分组、节点数量、更新状态和流量元数据。
- `profiles(id, data, created_at, updated_at)`：每行一个组合订阅。包含 `customId`、来源与手动节点的 ID 引用、规则模板、处理规则链、启用和排序信息。
- `settings(key, value, created_at, updated_at)`：站点设置、规则模板、永久来源快照、地区纠错及独立下载计数。

行级集合不再读取或迁移历史 `id=main` 数组。旧数组或损坏记录不会静默拼接成部分有效集合；个人模式读失败会明确返回错误，避免误保存为空。当前部署格式在删除回退前已经只读核对。

当前业务集合的内部键为 `misub_subscriptions_v1`、`misub_profiles_v1`，设置为 `worker_settings_v1`。它们不是新旧格式映射层；常规业务通过 `getAllSubscriptions()`、`putSubscription()`、`getAllProfiles()` 等行级方法读写。

## 快照与缓存

每来源成功节点结果保存于 `misub_source_snapshot_v1_*`。成功且有效的更新才覆盖快照，失败保留。临时刷新锁、失败退避与转换缓存独立管理，不替代永久快照。细节见 [来源快照](source-snapshots.md)。

地区纠错与匿名成功下载计数也由 D1 持久保存。KV 仅用于当前保留功能的辅助状态；个人模式没有业务数据或管理员认证的 KV 回退。

## 配置与认证

管理员密码、Cookie 签名密钥、主订阅 Token 和组合订阅 Token 由四项 Cloudflare Secrets 分别管理。应用备份不导出或恢复运行时 Secrets。`MISUB_PERSONAL_MODE=true` 强制使用 D1 并关闭外部管理、公开展示及第三方转换入口。

前端仅在内存中保存已认证集合与 Token；退出或会话失效时清除，迟到的读取响应不能再次注入数据。编辑修订号用于区分已提交版本与保存期间的新修改。

## 备份

JSON 备份包含指定范围内的当前业务集合、设置和持久快照等记录；恢复仍以当前 D1 行级格式存储。生产数据变更前另行保存受控 D1 SQL/Time Travel，不能以 Pages 代码回滚代替数据库恢复。见 [运维说明](PERSONAL-MAINTENANCE.md)。
