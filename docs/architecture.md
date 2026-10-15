# 架构

## 前端

Vue 3 + Pinia + Vue Router，Vite 构建，Tailwind 提供组件样式。`App.vue` 是唯一应用外壳；`NavBar` 提供桌面导航及移动底栏。浏览器地址保持 `/`，内部内存路由切换仪表盘、机场订阅、手动节点、我的订阅和设置。

`stores/session.js` 通过一次 `/api/data` 检查并注入已认证数据；`useDataStore` 保留内存中的业务集合、请求合并与编辑状态。不把订阅、节点或 Token 序列化到 Web Storage。登出清除内存数据，迟到的请求不能恢复登出前的数据；保存使用编辑修订号，避免响应覆盖请求期间的新修改。

页面与较重弹窗按需导入；设置只挂载当前栏目。设置保存后同步内存配置，无需整页重载。`settings`、`editor`、`theme`、`toast` 分别负责配置、编辑状态、主题和反馈。

`components/forms/Modal.vue` 是确认弹窗基础；`composables/useConfirm` 协调确认请求。保留专用复杂编辑弹窗，不通过通用抽象隐藏业务差异。

## 后端

Cloudflare Pages Functions 的 `functions/[[path]].js` 负责请求分类、CORS/CSRF、安全头、认证续期与路由。`modules/api-router.js` 分发管理请求；`modules/subscription/` 完成订阅解析、转换及输出；`services/` 处理源抓取、快照、节点缓存和规则链。

`storage-adapter.js` 对接 D1 与辅助 KV，个人模式以 D1 为权威。永久来源快照和临时转换缓存分开管理。保留原有绑定、表名、键及订阅 Token 路径，不执行数据库迁移。

## 测试与部署

`tests/` 覆盖认证、存储、快照、转换、管理 API 和前端状态。`scripts/browser-smoke.mjs` 使用合成数据检查本地构建的五个后台页面与响应式布局。GitHub Actions 执行测试、构建及浏览器验证。部署保持现有 Pages 项目和资源，见 [运维说明](PERSONAL-MAINTENANCE.md)。
