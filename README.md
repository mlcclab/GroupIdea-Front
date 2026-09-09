# GroupIdea Front

GroupIdea 的公开前端，用于课题组每周思考报告的提交与交流。

访问地址：[GroupIdea](https://mlcclab.github.io/GroupIdea-Front/)

## 使用

账号由 PI 分发，不开放注册。登录页左侧选择“课题组成员”或“游客”，右侧输入用户名和密码。课题组成员用户名必填；游客用户名可以留空，但仍必须输入管理员分配的密码。成员可以在“我的想法”上传或粘贴 Markdown；在“看看别人怎么想”阅读导师整理发布的总结。成员角色包括研究生、博士后和 PI；PI 登录后可在“成员管理”添加、停用、删除成员或重置密码。

游客用于授权的非课题组成员。系统只保留一个固定游客账号，用户名为 `vistor`，显示名为“游客”。管理员选择游客角色创建或重置账号时，用户名和显示名会自动锁定。游客登录后只显示“看看别人怎么想”，不能访问“我的想法”、成员管理或原始提交。

## 目录

- `web/`：正式前端、Markdown 渲染器和每周记录模板。
- `.github/workflows/pages.yml`：只发布 `web/` 的 GitHub Pages 工作流。
- `tests/`：前端数据处理和 API 请求测试。

## 部署与更新

在仓库 Settings → Pages 中选择 GitHub Actions。更新 `web/` 并推送到 `main` 后自动发布；也可以在 Actions 中手动运行 Publish GroupIdea web。

`web/config.js` 的 `apiBase` 配置 Cloudflare Worker 地址。使用自定义 Worker 域名时，还需更新 `web/index.html` 的 CSP `connect-src`。

前端只调用 Worker；GitHub Token 保存在 Worker Secret 中。账号、报告和总结由 Worker 读写独立的私有仓库。此公开仓库不存放用户数据或任何访问令牌。

## 检查

```bash
node --test tests/*.test.mjs
```

第三方 Markdown 渲染器的许可证见 `web/vendor/MARKED-LICENSE.md`。
