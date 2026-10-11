# zzpice 的 MiSub 维护说明

生产：`https://misub.zzp.moe`；Pages 项目：`misub`；独立仓库：`zzpice/misub`。
当前仅维护 `main` 生产分支；历史 `preview` 分支及其独立 D1、KV、Secrets 已弃用，不得在普通维护中重新创建。

## 来源与维护边界

初始代码来自 MIT 项目 `imzyb/MiSub`，基线提交为
`f8362c55ef9886289debf6263822b13636739008`（版本标识 2.7.0）。
保留 LICENSE、原作者版权及第三方依赖声明。仓库当前为 Public 独立快照，
2026-10-10 重建为单个根提交，**未保留完整上游 Git 历史**；不是 GitHub Fork，且已删除上游自动同步工作流。
仅 `main` 推送触发正式部署；不维护预览分支或自动同步、升级任务。

## 配置与凭据

生产必须设置 `MISUB_PERSONAL_MODE=true`，以及四个相互独立的 Secrets：
`ADMIN_PASSWORD`、`COOKIE_SECRET`、`SUBSCRIPTION_TOKEN`（mytoken）、`PROFILE_TOKEN`（profileToken）。
凭据单独保存在受控的私有凭据记录中，不写入本仓库、构建日志或公开报告。
Secrets 优先于数据库中的 Token 和 KV 认证记录。后台不能修改由 Secrets 控制的管理员密码或 Token。
密码变化后旧会话立即无效；正常部署保留 COOKIE_SECRET 和所有已有有效凭据，不自动轮换。

生产使用专属 MISUB_DB 与 MISUB_KV；现不维护 `misub-preview` D1/KV，实际生产绑定名称和标识以 Cloudflare 控制台为准。
D1 是设置、订阅、节点、订阅组和节点缓存的唯一业务数据来源；D1 故障不会回退到 KV 或伪装成空数据。
管理集合直接读取 D1，避免不同 Cloudflare 实例中的短时内存缓存让保存、备份或恢复使用旧数据。
KV 仅供保留功能的辅助运行状态使用，不镜像正式设置或订阅。不共享 Sub-Store 资源。
访客互动、公开订阅展示、公告、自定义主页、Telegram Bot 和错误遥测实现已删除。
客户端信息 API 仅管理员可访问；外部管理 API 和外部转换后端在个人模式关闭，内置转换保留。
`ENABLE_CRON=false`、`ENABLE_AUTH_DIAGNOSTICS=false`。Telegram Bot 不再支持；WebDAV 未配置，也未接入外部 Cron。

## 缓存与故障

保留上游的保护性缓存：3 分钟新鲜，之后后台刷新；最多复用 12 小时。
空结果和明显截断的结果不会覆盖健康缓存，远程源部分失败仍保留可用来源。
`X-Cache-Status`、`X-Cache-Time`、`X-Cache-Age` 和 Warning 区分缓存时间与当前响应时间。
12 小时后不再把旧缓存当有效节点返回。元数据 TTL 设置为 60 分钟，并发 3。
新建机场默认开启单源保护缓存；其上限同样为 12 小时。混合新节点和失败回退节点时，
组合缓存沿用最早回退源的时间并标记 stale，成功的其他源不会把旧源的年龄重置为零。
可按单个机场要求调整 User-Agent；修改 User-Agent 不能保证绕过服务端 403。

## 备份与恢复

1. 修改数据、恢复、升级或迁移前，后台「备份」导出 JSON。导出可含订阅 URL、节点密码及设置 Token，必须按密码保护。
2. D1 使用 Cloudflare 控制台的导出/Time Travel，或本机 `wrangler d1 export misub-production --remote --output /安全私有目录/misub.sql`。
   不在公开仓库保存 JSON/SQL，不把凭据放在命令参数或终端日志中。
3. 免费 D1 的 Time Travel 保留期限以当前控制台为准。重大变更前额外手工导出完整 SQL；备份存放在加密磁盘或受控私有位置。
4. 使用合成数据在本地隔离数据库验证 JSON 恢复和 SQL 导入；未经明确授权不得新建云端预览资源或在生产执行恢复演练。正式恢复前再次备份并核对数据库名称与 UUID，避免覆盖别的服务。
5. JSON 恢复在后台执行（管理员 API 为 `/api/backup/restore`）；可以先通过 `/api/backup/export` 导出。
   Secrets 不依赖 JSON/SQL 备份，须由维护者通过受控凭据记录另行恢复；测试数据及测试凭据不得使用生产值。
6. Pages 历史部署可回滚代码；**回滚 Pages 不会恢复 D1 数据或撤销数据库迁移**。
   有 schema 变化时必须有单独的 SQL 恢复计划，再执行代码回滚。

## 独立版本与选择性维护

版本由当前 package.json 的兼容版本与本仓库构建提交共同标识。Cloudflare 使用 `CF_PAGES_COMMIT_SHA`，
本地构建读取当前 Git 提交；没有 Git 信息时只显示兼容版本，不假定自己是“最新版本”。
不依赖原作者的 Release、更新接口或专属静态资源；本地 Git 仅保留指向 `zzpice/misub` 的 origin。
没有创建正式 Release。需要发布时由维护者基于本仓库已验证的提交手动决定版本与 Tag。

仅在确有漏洞、实际问题或有价值的功能时更新。改动来自人工审查与必要测试，不要求获取或合并原仓库。
禁止对 main 强制推送、reset 为上游或恢复上游同步工作流。锁文件只随经过审查的依赖修复更新。
运行 `npm ci`、`npm run test:run`、`npm run build`；协议转换变更还须用实际 Mihomo/sing-box 校验配置。
先在本地隔离测试环境完成验证；未经明确授权不创建 preview 或其他云端测试资源，通过后再正常推送 `main`。
保留一次合并前 Pages 部署和数据库备份。检查 Cloudflare 部署完成及实际 API 读写，不能仅看 GitHub 提交成功。

## 源站抓取故障

本机能访问源站不代表 Cloudflare 子请求一定能访问。排查时使用合成地址或脱敏日志，
不要把真实订阅、服务器地址、端口、路径或节点写入公开文档。
Cloudflare Workers 对直接 IP 抓取有限制，必要时使用自己的 A/AAAA 域名记录。
如源站端口不在 Cloudflare 代理支持范围，使用仅 DNS；DNS 本身不会为源站增加 HTTPS。
通用诊断接口的白名单与正常订阅抓取是不同路径，应分别判断应用校验和源站 HTTP 错误。

参考 [Workers 已知限制](https://developers.cloudflare.com/workers/platform/known-issues/#fetch-to-ip-addresses)
与 [Cloudflare 网络端口](https://developers.cloudflare.com/fundamentals/reference/network-ports/)。

## 个人版精简与数据保留

源码不再包含留言、Explore、公告、自定义主页或 Telegram Bot。旧对应 API 返回 404。
个人模式的唯一网页入口为 `/`：未登录显示登录表单，登录后由内存路由切换后台模块。
其他非业务网页路径由 Pages Functions 返回空正文 HTTP 403；`/api/*`、真实订阅 Token 路径和静态资源不受此限制。
`/api/login_config` 仅保留兼容响应，不再指定或公开自定义登录路径。
删除功能不清理数据库记录，不执行 schema 迁移，不更改 Cloudflare 绑定、Secrets 或订阅数据。
备份中若含历史社区字段，可保留为存档；恢复不重新启用已移除功能。
本仓库当前为 Public。已有的根提交重置不保证旧 Git 对象或部署记录不可访问；
若发现疑似真实凭据，先核实来源与有效性并由维护者决定处置，不自动轮换凭据或改写历史。
