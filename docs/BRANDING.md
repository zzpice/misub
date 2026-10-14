# MiSub · zzpice 品牌与版本约定

- 项目名称仍为 **MiSub**；发行/维护标识统一为 **MiSub · zzpice**。
- 官方代码位置为 `https://github.com/zzpice/misub`，实例域名为 `https://misub.zzp.moe`。
- 当前独立版本起点为 **1.0.0**。`package.json`、`package-lock.json`、后端 `VERSION` 必须保持同步，界面页脚显示版本与构建 Git SHA；正式 Release/Tag 不自动创建。
- 上游项目为 `imzyb/MiSub`，参考版本 2.7.0。请保留 [LICENSE](../LICENSE) 原版权、[NOTICE](../NOTICE.md) 来源声明以及第三方许可。不要将衍生软件描述为从零独立创作。
- 浏览器 `<title>`、动态路由标题、页脚及登录/导航 SVG 标志使用统一品牌。SVG 标志是公开仓库中的 `public/brand.svg`；页面通过 BrandMark 内联导入同一份 SVG 源文件，避免伪装模式封锁静态品牌资源时显示损坏图片。
- 旧路径 `public/logo.png` 保留为同一 SVG 的 512px PNG 版本，更新品牌时一并同步；Home 项目页也使用这一图形。
- 如开启伪装，`/brand.svg` 必须与旧 `/logo.png` 一样执行未经授权的品牌资源屏蔽，避免暴露站点指纹。
- 改品牌不意味着改域名、Token、D1、KV、Cloudflare Pages 项目，也不意味着修改任何客户端已有的订阅链接。
- GitHub **About** 建议填写：`Independent MiSub edition by zzpice · subscription snapshots, conversion and distribution`；Website 填写 `https://misub.zzp.moe`。修改仓库 About 属于 GitHub 仓库元数据，不依赖 README 或项目构建，需有相应仓库设置权限。

查看当前运行版本，以生产 Pages **实际部署 SHA** 为准，不能只凭 GitHub 合并成功判断线上已更新。
