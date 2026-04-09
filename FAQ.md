# 常见问题

## 构建与部署

### Q: EdgeOne Pages 构建失败，提示 "Output directory dist does not exist"

A: 检查 `edgeone.json` 中的 `outputDirectory` 是否为 `dist`，且 `npm run build` 确实会生成 `dist/` 目录。

### Q: 部署后样式没有更新

A: 修改 `base.html` 中 CSS 引用版本号：

```html
<link rel="stylesheet" href="assets/css/style.css?v=3">
```

或强制刷新浏览器 `Ctrl+F5`。

### Q: 自定义域名显示 "已生效" 但访问不到

A: 等待 2-5 分钟 DNS 全球生效，或刷新本地 DNS 缓存：

```powershell
ipconfig /flushdns
```

## 文章写作

### Q: 文章中的 `.md` 链接不会自动跳转

A: 确保使用相对路径格式：

```markdown
[相关文章](./another-article.md)
```

构建时会自动转换为 `https://your-domain/posts/another-article/`。

### Q: 代码块没有高亮

A: 目前未集成语法高亮库。如需高亮，可引入 Prism.js 或 highlight.js，在 `base.html` 中添加对应 CDN。

### Q: 文章删除后页面还在

A: 删除 `content/posts/xxx.md` 后重新 `git push`，下次构建会自动清理。

## 主题与样式

### Q: 如何修改字体

A: 在 `base.html` 引入字体 CDN，然后在 `style.css` 中修改 `font-family`。

### Q: 移动端样式错乱

A: 检查 `style.css` 底部的 `@media` 查询，按需调整断点。

## 其他

### Q: 账户存储超限 5GB

A: 在 EdgeOne Pages 控制台删除旧部署记录释放空间。

### Q: 支持多少篇文章？

A: 无硬性数量限制，受 5GB 存储和 20,000 文件数限制。纯文本博客通常可支持数千篇。
