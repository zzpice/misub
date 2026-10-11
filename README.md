# MiSub · zzpice

[![Tests and build](https://github.com/zzpice/misub/actions/workflows/check.yml/badge.svg)](https://github.com/zzpice/misub/actions/workflows/check.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**独立维护的个人订阅管理与分发工具。** 统一管理机场、VPS 和手动节点，将上游订阅保存为永久快照，再向不同客户端提供需要的订阅格式。

- 正式网站：**[misub.zzp.moe](https://misub.zzp.moe)**（私人管理界面，需要认证）
- 维护者：**[zzpice](https://github.com/zzpice)**；正式代码与问题修复以本仓库 `main` 为准
- 项目版本：**v1.0.0（zzpice 独立版本线）**，实际构建号显示为 Git 提交短 SHA
- 来源：基于 [imzyb/MiSub](https://github.com/imzyb/MiSub) 及原版 **v2.7.0** 基线 `f8362c55ef9886289debf6263822b13636739008` 演进

> 这是独立演进的衍生作品，不是原作者发布的官方版本，不自动同步上游。本仓库保留原项目 [MIT 许可证](LICENSE) 及原作者署名；详见 [NOTICE](NOTICE.md)。公开源码并不意味着公开订阅源、账号信息或管理入口。

## 主要功能

- **订阅管理**：远程 HTTP 订阅、手动节点、订阅组；可过滤、排序、重命名和去重
- **永久快照**：上游更新成功才覆盖原快照；上游故障、403、空内容、异常截断不会主动删除上次成功的节点
- **自动更新**：每来源可设置刷新间隔与开关；客户端读取时可以触发后台刷新；可选外部定时器调用认证 `/cron` 主动刷新，无需依赖打开管理网页
- **地区识别**：名称与国旗自动识别，支持单节点或批量手动纠错及来源默认地区
- **多客户端分发**：内置生成 Mihomo/Clash、sing-box、Surge、Loon、Quantumult X 和通用节点链接/Base64；**不依赖客户端下载展示目录**
- **安全与维护**：管理员身份验证、订阅 Token、D1 业务数据、配置备份、浅色/深色及中英文界面

订阅生成允许客户端以 URL/Token 读取；管理界面不公开。个人模式关闭详细访问日志，订阅组仅记录匿名的**成功拉取次数**（不会记录访问者 IP）。

## 使用与自动更新

```text
机场 / VPS / 手动节点
        │
        ▼
MiSub：按来源更新 → 验证 → D1 永久节点快照
        │                ↑
        │             失败保留旧版
        ▼
客户端通过 MiSub 订阅链接读取（Mihomo / sing-box / 其他）
```

- 来源的自动更新开关和间隔由每个订阅源独立决定；失败会受到重试退避限制
- 管理界面的「刷新」用于手动请求上游；仅查看页面不会刷新全部来源
- **永久缓存**与传统的短期聚合缓存不同：来源永久快照不会因 12 小时 TTL 自动失效
- 不配置外部定时器时，客户端请求可触发后台更新，但不能保证空闲期间的定时更新
- `Cron Secret` 本身不是调度器；启用 `ENABLE_CRON` 并配置可信外部定时 HTTPS 请求后，才会有无人访问时的主动刷新
- 更多说明：[永久快照机制](docs/source-snapshots.md)、[外部定时刷新](docs/CRON_DASHBOARD_GUIDE.md)

## Cloudflare Pages 部署

生产已经在运行时，请**继续使用现有 Pages 项目和原 D1、KV、Secrets**，不要为了品牌更新重新创建或迁移资源。

新建个人实例时：

1. 将 GitHub 仓库连接到 Cloudflare Pages，生产分支 `main`，构建命令 `npm run build`，输出目录 `dist`，使用 Node.js 24
2. 初始化专属 D1（见 [schema.sql](schema.sql)），以 `MISUB_DB` 绑定；将辅助 KV 绑定为 `MISUB_KV`
3. 设置 `MISUB_PERSONAL_MODE=true`，将 `ADMIN_PASSWORD`、`COOKIE_SECRET`、`SUBSCRIPTION_TOKEN` 和 `PROFILE_TOKEN` 配为四项互不相同的独立 Secrets
4. 默认保持 `ENABLE_CRON=false`、`ENABLE_AUTH_DIAGNOSTICS=false`；如需要外部定时任务，再单独配置 Cron 密钥与调度器
5. 确认正式部署提交、管理员登录、订阅 Token、各来源快照及 D1 持久化正常

现有个人实例不维护 preview 分支、预览 D1/KV 或额外的 Cloudflare 服务。**仓库不保存生产 Secrets、订阅 URL 或节点凭据。**

## 开发与维护

```bash
npm ci
npm run test:run
npm run build
npm run dev
```

保持独立版本线：`package.json` 和后端 `VERSION` 使用本项目版本；原版 v2.7.0 仅作来源基线，不再当作当前应用版本。页脚另显示实际 Git Commit，方便核对部署。更新原则是**按需修复，而非自动追上游**；不得强制重置 `main` 或创建未经授权的测试云资源。

兼容旧缓存时应以现有永久快照和 [维护与恢复说明](docs/PERSONAL-MAINTENANCE.md) 为准。升级之前备份 D1；GitHub 或 Pages 的代码回滚**不会自动恢复 D1 数据**。

## 版权与致谢

© 2026 MiSub Contributors（原项目，详见 [LICENSE](LICENSE)）；
zzpice 维护本独立版本并贡献后续改动。项目按照 MIT 条款分发。感谢原作者 [imzyb](https://github.com/imzyb) 与原 MiSub Contributors。对第三方依赖仍遵守其各自许可。
