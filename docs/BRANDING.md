# 品牌与资源标识

- 完整名称与浏览器标题：**Zzp Sub**；仓库与 npm 包名：`zzp-sub`。
- 管理入口：`https://sub.zzp.moe`；代码：`https://github.com/zzpice/zzp-sub`。
- 新域名验证通过后移除旧域名，不设置旧域名重定向或别名；客户端需更新订阅域名。
- Logo 使用 `public/brand.svg` 的 Z 字标；`BrandMark` 内联同一 SVG，`public/logo.png` 为同图 PNG。伪装开启时两种静态资源均保留访问保护。
- 页脚显示本项目版本和实际 Git SHA。包、锁文件及后端 `SYSTEM_CONSTANTS.VERSION` 同步更新。
- `MISUB_DB`、`MISUB_KV`、`MISUB_PERSONAL_MODE`、数据键、表名、API 字段、旧诊断头与后端 User-Agent 是已部署技术契约，保留以避免丢失数据或破坏集成。
- WebDAV 新实例默认目录为 `/Zzp-Sub`。已保存的用户自定义远端目录继续作为用户配置读取，不自动搬移或删除备份。
- MIT 版权、原项目链接与来源说明见 [LICENSE](../LICENSE) 和 [NOTICE](../NOTICE.md)。
