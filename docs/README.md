# MiSub 文档

本仓库是 zzpice 独立维护的个人版，当前部署以 [主说明](../README.md) 和
[维护与恢复](PERSONAL-MAINTENANCE.md) 为准。保留的上游工程文档用于理解代码与兼容性，
其中历史升级、公开分享、Cron 和外部管理 API 说明不代表本实例启用了这些功能。

## 核心文档

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — 仓库布局、模块边界、开发约定。
- [TECHNICAL_DETAILS.md](TECHNICAL_DETAILS.md) — 后端管道、operator chain、存储适配器、节点解析说明。
- [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md) — 前后端开发规范（风格、目录、测试、提交约定）。
- [architecture.md](architecture.md) — 总体架构说明。
- [data-model.md](data-model.md) — 数据模型说明。

## API / 外部管理

- [api-routes.md](api-routes.md) — 后端 /api 路由与 handler 映射。
- [external-management-api.md](external-management-api.md) — 外部管理 API 使用说明。
- [external-management-api.openapi.yaml](external-management-api.openapi.yaml) — 外部管理 API OpenAPI 规范。
- [external-management-api-usage.md](external-management-api-usage.md) — 外部管理 API 用法示例。

## 订阅 / 转换

- [subscription-request-flow.md](subscription-request-flow.md) — `/sub/*` 订阅请求处理链路。
- [fetch-proxy-tutorial.md](fetch-proxy-tutorial.md) — fetch proxy 行为与配置。
- [OPERATOR_CHAIN_GUIDE.md](OPERATOR_CHAIN_GUIDE.md) — operator chain 用法与概念。
- [examples/](examples/) — 订阅/模板示例。

## 运维 / 迁移

- [PERSONAL-MAINTENANCE.md](PERSONAL-MAINTENANCE.md) — 当前个人部署、隔离、备份与维护约定。
- [安全说明](../SECURITY.md) — 凭据保护与漏洞报告。
- [CRON_DASHBOARD_GUIDE.md](CRON_DASHBOARD_GUIDE.md) — cron 仪表盘指南。
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) — 迁移指南。
- [UPGRADE_V2.5.md](UPGRADE_V2.5.md) — v2.5 升级历史。
- [plans/](plans/) — 历史规划文档。
