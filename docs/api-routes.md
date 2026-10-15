# API 与访问边界

入口为 `functions/[[path]].js`，管理分发为 `modules/api-router.js`。下表描述个人生产实例的主要接口；路由使用现有稳定业务路径，不因品牌更名复制一套路由。

| 路径                                        | 用途与访问要求                                          |
| ------------------------------------------- | ------------------------------------------------------- |
| `/`                                         | 登录或已认证后台，内部内存路由切换模块                  |
| `/api/login`                                | POST，管理员密码验证与会话 Cookie                       |
| `/api/logout`                               | 清除管理员会话                                          |
| `/api/data`                                 | GET；未登录仅返回认证状态，已登录读取当前集合与受控配置 |
| `/api/misubs`                               | 管理员保存订阅、手动节点和组合订阅                      |
| `/api/settings`                             | 管理员读取/保存设置；Secrets 控制的凭据不可由后台覆盖   |
| `/api/rule_templates`                       | 管理员维护规则模板                                      |
| `/api/backup/export`、`/api/backup/restore` | 管理员业务备份与恢复                                    |
| `/api/logs`                                 | 管理员诊断日志；个人模式默认关闭详细访问记录            |
| `/api/source/*`、节点/地区相关管理路由      | 管理员刷新、预览与地区纠错，具体分发见路由源码          |
| `/<主Token>`、`/<组Token>/<标识>`           | 经订阅 Token 验证的节点输出与组合订阅                   |
| `/cron`                                     | 可选认证外部刷新，需显式启用与独立 Cron 密钥            |

所有写入受同源/CSRF 校验保护。个人模式仅根路径作为网页入口，其他非业务页面路径返回空正文 403。未认证管理请求不能读取节点或修改数据；订阅路径独立验证 Token，不依赖后台浏览器会话。

旧 `/api/login_config`、`/api/migrate`、`/api/migrate_to_d1`、`/api/detect_legacy_d1` 和 `/api/migrate_legacy_d1` 已移除，返回 404。公开展示、访客互动、Telegram、旧客户端目录和遥测接口也不恢复。

外部管理 API 与第三方转换在个人模式关闭。格式协商、内置转换、来源自动更新和永久快照继续由订阅链路提供，见 [请求链路](subscription-request-flow.md) 与 [快照](source-snapshots.md)。
