# Zzp Sub

个人订阅管理与分发工具，基于 Vue 3、Cloudflare Pages Functions、D1 与 KV。

- 管理入口：[sub.zzp.moe](https://sub.zzp.moe)
- 代码与维护：[zzpice/zzp-sub](https://github.com/zzpice/zzp-sub)
- 版本：1.1.0；页脚显示实际构建提交

## 功能

- 管理远程订阅、手动节点和组合订阅，支持搜索、分组、排序、过滤、重命名和去重。
- 每个来源保存 D1 永久快照。上游异常、空内容或可疑截断时保留上次成功结果。
- 按来源控制自动更新；客户端读取可触发后台刷新，可选认证 `/cron` 外部调度。
- 内置生成 Mihomo/Clash、sing-box、Surge、Loon、Quantumult X 与通用节点链接。
- 管理员密码认证、独立订阅 Token、备份恢复、中英文和深浅主题。

后台仅通过根路径进入，内部页面使用内存路由。管理 API 需要管理员会话，订阅读取使用既有 Token。没有引入 Zero Trust。

## 本地开发

使用 Node.js 24：

```sh
npm ci
npm run test:run
npm run build
npx playwright install chromium
npm run test:browser
npm run dev
```

浏览器测试使用本地合成数据，覆盖登录、五个后台页面、搜索、设置切换、四种屏幕宽度及深色主题，不连接生产数据。`npm run dev:server` 可运行本地 Pages Functions。

## 部署与迁移

**现有实例沿用 Pages 项目 `misub` 及原 D1、KV、Secrets。** 不因改品牌重建资源。新域名验证通过后移除旧域名，旧链接不再兼容；客户端需重新导入新域名的订阅链接。

绑定名称继续使用 `MISUB_DB`、`MISUB_KV`，现有数据键、表名、订阅路径和诊断头保持稳定。生产设置 `MISUB_PERSONAL_MODE=true`；`ADMIN_PASSWORD`、`COOKIE_SECRET`、`SUBSCRIPTION_TOKEN`、`PROFILE_TOKEN` 是四个独立 Secrets，发布不轮换它们。

新建实例才需要专属 D1、KV 和 `schema.sql` 初始化；现有实例不执行 schema 迁移。构建命令 `npm run build`，产物 `dist`。具体发布和回滚步骤见 [运维说明](docs/PERSONAL-MAINTENANCE.md)。

## 文档

[架构](docs/architecture.md) · [永久快照](docs/source-snapshots.md) · [自动更新](docs/CRON_DASHBOARD_GUIDE.md) · [品牌](docs/BRANDING.md) · [本次重构](docs/refactor.md) · [API 与数据模型](docs/README.md)

## 开源来源

衍生自 [imzyb/MiSub](https://github.com/imzyb/MiSub) upstream v2.7.0，基线提交 `f8362c55ef9886289debf6263822b13636739008`。由 zzpice 独立维护，不自动同步上游。

保留原作者及贡献者的 [MIT License](LICENSE)，来源与第三方声明见 [NOTICE](NOTICE.md)。
