# MiSub · zzpice 个人维护版

[![Tests and build](https://github.com/zzpice/misub/actions/workflows/check.yml/badge.svg)](https://github.com/zzpice/misub/actions/workflows/check.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

MiSub 是一个部署在 Cloudflare Pages 上的订阅与节点管理工具。本项目基于
[imzyb/MiSub](https://github.com/imzyb/MiSub)，由 **zzpice 独立维护**，保留原项目的
MIT 许可证、原作者署名及版权声明。当前仓库于 2026-10-10 建立独立根提交，
**不包含完整上游 Git 历史**。原项目参考基线为
`f8362c55ef9886289debf6263822b13636739008`（2.7.0）。

维护目标是长期稳定的个人使用。没有自动同步、合并或升级上游的任务；只按需要人工审查修复。
公开代码不代表公开管理后台、订阅数据或 API。
页面、版本管理和部署不调用原作者的 MiSub 服务。页脚显示兼容版本 `2.7.0`、维护者及实际构建提交号；
当前代码状态以本仓库提交为准，不比较原项目 Release，也不自动显示更新提示。

## 实际功能

- 管理远程订阅、手动节点与订阅组合，查看流量、到期时间和节点缓存。
- 按协议、地区或正则过滤节点，重命名、排序、去重并配置操作符链。
- 使用内置模板生成 Mihomo/Clash、sing-box、Surge、Loon、Quantumult X、URI/Base64 等客户端订阅。
- 管理员登录、带 Token 的客户端订阅访问、配置备份与恢复。
- Vue 3 响应式界面，支持浅色/深色主题与中英文。

个人部署启用 `MISUB_PERSONAL_MODE=true`：D1 是业务数据的唯一来源，四项独立 Secrets 控制认证；
留言与反馈、Explore 公开展示、公告、自定义公开主页及 Telegram Bot 管理/推送/Webhook 已从前后端移除。
外部管理 API、外部转换后端和访问日志在个人模式下关闭；错误处理只在本地提示和记录。KV 只保存辅助运行状态。
Telegram 服务分流规则、管理员节点预览、客户端信息与订阅链接生成保留。旧社区配置和记录原样保存在存储中，不再使用。
定时刷新与认证诊断也默认关闭。旧文档中的可选 KV 存储、默认密码和公开分享部署说明不适用于此模式。

## Cloudflare Pages 部署

新建自己的实例时，复制仓库后使用 Cloudflare Pages 的 Git 集成。已经运行的实例直接维护原 Pages 项目，
不要重新创建服务或存储。

1. 连接自己的 GitHub 仓库，生产分支选 `main`，构建命令 `npm run build`，输出目录 `dist`，Node.js 使用 24。
2. 创建专属 D1，执行 [schema.sql](schema.sql)，绑定名为 `MISUB_DB`；创建专属 KV，绑定名为 `MISUB_KV`。
3. 在 Pages 环境变量中设置 `MISUB_PERSONAL_MODE=true`、`ENABLE_CRON=false`、`ENABLE_AUTH_DIAGNOSTICS=false`。
4. 在 Pages 中分别设置四项 Secret：`ADMIN_PASSWORD`、`COOKIE_SECRET`、`SUBSCRIPTION_TOKEN`、`PROFILE_TOKEN`。
   每项至少 32 个字符，值必须互不相同；由密码管理器生成和保存。没有可直接用于生产的默认凭据。
5. 现有实例仅使用正式分支 `main`，不维护预览分支、预览 D1、预览 KV 或预览 Secrets。日后确需新增隔离测试部署时，先单独审查并明确授权。
6. 部署后核对实际绑定、管理员登录、未登录 API 拒绝访问、订阅 Token 校验与数据持久化，再绑定正式域名。

现有个人实例使用 [misub.zzp.moe](https://misub.zzp.moe)，管理与订阅访问需要原有凭据。
仓库不保存这些凭据或订阅数据。运行时配置由 Cloudflare Pages 项目管理；修改源码或文档不会要求轮换 Secrets。

## 本地开发与验证

需要 Node.js 24 与 npm，依赖版本以锁文件为准：

```sh
npm ci
npm run test:run
npm run build
npm run dev
```

后端调试前先构建，在被 Git 忽略的本地 `wrangler.toml` 中配置测试 D1/KV，
在 `.dev.vars` 中放置专用测试 Secrets。使用本地数据库初始化 `schema.sql`，再运行 `npm run dev:server`。
不要使用 `--remote` 初始化开发库，也不要复制生产订阅或生产 Secrets 作为测试数据。

## 长期维护

- 唯一 CI 运行测试和构建；main 推送通过现有 Cloudflare Git 集成自动部署，无需在 Actions 保存部署 Token。
- 保持锁文件；只为明确问题修改依赖，不批量追新版本。
- 保留 2.7.0 兼容基线，并在页脚显示实际 Git Commit；以本仓库的提交、测试和部署结果管理版本；按实际问题人工审查修复，禁止强制推送、重置 main 或加入自动同步工作流。
- 修改代码时运行相关测试和构建；协议转换变更还需用实际客户端配置校验工具验证输出。
- 数据恢复、迁移或升级前备份；优先用合成数据在本地隔离环境验证，未经明确授权不新建云端预览或触碰生产数据。Pages 代码回滚不会恢复 D1 数据。
- 部署以 Cloudflare 的实际提交与线上认证检查为准，不能仅凭 GitHub 推送成功判断完成。

详见 [维护与恢复](docs/PERSONAL-MAINTENANCE.md)、[文档索引](docs/README.md)、
[操作符链](docs/OPERATOR_CHAIN_GUIDE.md) 和 [安全说明](SECURITY.md)。

## 许可证与致谢

采用 [MIT License](LICENSE)。感谢 imzyb 与原 MiSub Contributors；原版权声明保持不变。
第三方依赖保留其各自许可证。此个人维护版与上游独立演进，不承诺自动跟进上游版本。
