# 主题定制指南

## 文件位置

| 文件 | 作用 |
|------|------|
| `src/assets/css/style.css` | 全部样式 |
| `src/templates/base.html` | 基础布局模板 |
| `src/templates/index.html` | 首页文章列表 |
| `src/templates/post.html` | 文章详情页 |
| `src/templates/tag.html` | 单标签页 |
| `src/templates/tags.html` | 标签云页 |
| `src/templates/archive.html` | 归档页 |

## CSS 变量

根变量定义在 `:root` 中：

```css
:root {
  --primary: #3273dc;        /* 主色调（链接、按钮） */
  --primary-dark: #2366d1;   /* 悬停色 */
  --text: #363636;           /* 正文颜色 */
  --text-light: #7a7a7a;     /* 次要文字 */
  --text-muted: #b5b5b5;     /* 辅助文字 */
  --bg: #f5f5f5;             /* 页面背景 */
  --bg-white: #ffffff;       /* 卡片背景 */
  --border: #dbdbdb;         /* 边框色 */
  --shadow: 0 2px 3px rgba(10,10,10,0.1);
  --shadow-hover: 0 4px 6px rgba(10,10,10,0.15);
  --radius: 4px;             /* 圆角 */
  --sidebar-width: 220px;    /* 侧边栏宽度 */
  --content-max: 800px;      /* 内容区最大宽度 */
}
```

## 常用修改

### 修改主色调

```css
:root {
  --primary: #e53935;        /* 改为红色 */
  --primary-dark: #c62828;
}
```

### 调整页面宽度

```css
:root {
  --content-max: 900px;
}
```

### 暗色模式（可选）

在 CSS 底部添加：

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --bg-white: #2d2d2d;
    --text: #e0e0e0;
    --text-light: #aaa;
    --border: #444;
  }
}
```

## 模板语法

使用 [Nunjucks](https://mozilla.github.io/nunjucks/templating.html)：

```html
<!-- 变量 -->
{{ site.title }}

<!-- 条件 -->
{% if post.tags.length %}
  {% for tag in post.tags %}
    <span>{{ tag }}</span>
  {% endfor %}
{% endif %}

<!-- 过滤器 -->
{{ post.excerpt | striptags | truncate(120) }}
{{ post.content | safe }}
```

## 强制刷新 CSS

修改样式后，更新 `base.html` 中的版本号：

```html
<link rel="stylesheet" href="{{ root }}assets/css/style.css?v=3">
```

浏览器会强制重新加载，不受缓存影响。
