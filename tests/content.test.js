const { sanitizeHtml } = require('../lib/content');

describe('sanitizeHtml', () => {
  it('allows basic safe HTML tags', () => {
    const input = '<p>Hello <strong>World</strong></p>';
    expect(sanitizeHtml(input)).toBe('<p>Hello <strong>World</strong></p>');
  });

  it('removes dangerous script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('removes event handlers', () => {
    const input = '<p onclick="alert(\'xss\')">Click me</p>';
    expect(sanitizeHtml(input)).toBe('<p>Click me</p>');
  });

  it('allows img tag with allowed attributes', () => {
    const input = '<img src="image.jpg" alt="desc" width="100" height="100" loading="lazy" />';
    expect(sanitizeHtml(input)).toBe('<img src="image.jpg" alt="desc" width="100" height="100" loading="lazy" />');
  });

  it('removes disallowed img attributes', () => {
    const input = '<img src="image.jpg" onerror="alert(\'xss\')" />';
    expect(sanitizeHtml(input)).toBe('<img src="image.jpg" />');
  });

  it('allows iframe tag with allowed hostnames', () => {
    const input = '<iframe src="https://www.youtube.com/embed/123" width="100%" height="400" frameborder="0" allow="fullscreen" allowfullscreen></iframe>';
    expect(sanitizeHtml(input)).toBe('<iframe src="https://www.youtube.com/embed/123" width="100%" height="400" frameborder="0" allow="fullscreen" allowfullscreen></iframe>');
  });

  it('allows bilibili iframe', () => {
    const input = '<iframe src="https://player.bilibili.com/player.html?bvid=123" width="100%" height="400" frameborder="0" allowfullscreen></iframe>';
    expect(sanitizeHtml(input)).toBe('<iframe src="https://player.bilibili.com/player.html?bvid=123" width="100%" height="400" frameborder="0" allowfullscreen></iframe>');
  });

  it('removes iframe src with disallowed hostnames', () => {
    const input = '<iframe src="https://example.com" width="100%" height="400" frameborder="0" allow="fullscreen" allowfullscreen></iframe>';
    expect(sanitizeHtml(input)).toBe('<iframe width="100%" height="400" frameborder="0" allow="fullscreen" allowfullscreen></iframe>');
  });

  it('allows details and summary tags', () => {
    const input = '<details open><summary>Title</summary>Content</details>';
    expect(sanitizeHtml(input)).toBe('<details open><summary>Title</summary>Content</details>');
  });

  it('adds noopener noreferrer to target="_blank" links', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
  });

  it('preserves existing rel attributes and adds missing ones for target="_blank"', () => {
    const input = '<a href="https://example.com" target="_blank" rel="nofollow">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('noopener');
    expect(result).toContain('noreferrer');
    expect(result).toContain('nofollow');
  });

  it('does not modify links without target="_blank"', () => {
    const input = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(input)).toBe('<a href="https://example.com">Link</a>');
  });

  it('removes javascript: URLs', () => {
    const input = '<a href="javascript:alert(\'xss\')">Click</a>';
    expect(sanitizeHtml(input)).toBe('<a>Click</a>');
  });

  it('allows http and https URLs', () => {
    const input = '<a href="https://example.com">Secure</a><a href="http://example.com">Insecure</a>';
    expect(sanitizeHtml(input)).toBe('<a href="https://example.com">Secure</a><a href="http://example.com">Insecure</a>');
  });

  it('allows mailto URLs', () => {
    const input = '<a href="mailto:test@example.com">Email</a>';
    expect(sanitizeHtml(input)).toBe('<a href="mailto:test@example.com">Email</a>');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles plain text without HTML', () => {
    expect(sanitizeHtml('Just plain text')).toBe('Just plain text');
  });

  it('handles Chinese content', () => {
    const input = '<p>这是一段<strong>中文</strong>内容</p>';
    expect(sanitizeHtml(input)).toBe('<p>这是一段<strong>中文</strong>内容</p>');
  });

  it('removes style tags', () => {
    const input = '<style>body { color: red; }</style><p>Text</p>';
    expect(sanitizeHtml(input)).toBe('<p>Text</p>');
  });

  it('removes inline styles', () => {
    const input = '<p style="color: red;">Text</p>';
    expect(sanitizeHtml(input)).toBe('<p>Text</p>');
  });

  it('returns empty string for null input', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('throws error for non-string object input', () => {
    expect(() => sanitizeHtml({ a: 1 })).toThrow();
  });
});
