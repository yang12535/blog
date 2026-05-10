// Bogl - Enhanced interactions: scroll effects, back-to-top, code blocks, mermaid
(function() {
  'use strict';

  // ── 1. Navbar scroll effect ──
  var navbar = document.querySelector('.navbar');
  var scrollTopBtn = null;

  function onScroll() {
    var scrolled = window.pageYOffset > 10;

    // Navbar shadow
    if (navbar) {
      navbar.classList.toggle('navbar-scrolled', scrolled);
    }

    // Scroll-to-top button visibility
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle('visible', window.pageYOffset > 400);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ── 2. Scroll-to-top button (desktop only) ──
  function createScrollTopBtn() {
    if (window.innerWidth <= 1024) return null;
    var btn = document.createElement('div');
    btn.className = 'scroll-top';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', '回到顶部');
    btn.setAttribute('title', '回到顶部');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
    btn.addEventListener('click', scrollToTop);
    btn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToTop();
      }
    });
    document.body.appendChild(btn);
    return btn;
  }

  scrollTopBtn = createScrollTopBtn();
  onScroll(); // Init after button created

  // ── 3. Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      var target = document.getElementById(targetId.slice(1));
      if (target) {
        e.preventDefault();
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        // Update URL hash without jumping, then move focus for a11y
        if (history.pushState) {
          history.pushState(null, null, targetId);
        } else {
          location.hash = targetId;
        }
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });

  // ── 4. Mermaid diagram rendering ──
  function renderMermaid() {
    if (typeof mermaid === 'undefined') return;

    var blocks = document.querySelectorAll('pre code.language-mermaid, pre code.mermaid');
    if (blocks.length === 0) return;

    mermaid.initialize({ startOnLoad: false, theme: 'default' });

    blocks.forEach(function(block, index) {
      var pre = block.parentNode;
      var graphDefinition = block.textContent.trim();
      if (!graphDefinition) return;

      var id = 'mermaid-' + index;
      try {
        mermaid.render(id, graphDefinition).then(function(result) {
          var wrapper = document.createElement('div');
          wrapper.className = 'mermaid-diagram';
          var parser = new DOMParser();
          var doc = parser.parseFromString(result.svg, 'image/svg+xml');
          // 移除 script 标签
          doc.querySelectorAll('script').forEach(function(el) { el.remove(); });

          // 移除所有以 on 开头的事件处理器属性
          var allElements = doc.querySelectorAll('*');
          allElements.forEach(function(el) {
            Array.from(el.attributes).forEach(function(attr) {
              if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
              }
            });
          });

          // 移除危险的 SVG 元素
          doc.querySelectorAll('foreignObject, animate, animateMotion, animateTransform, set, use').forEach(function(el) { el.remove(); });

          // 清理 href 和 xlink:href 属性中的 javascript: 协议
          doc.querySelectorAll('[href], [xlink\\:href]').forEach(function(el) {
            var href = el.getAttribute('href') || el.getAttribute('xlink:href');
            if (href && href.toLowerCase().startsWith('javascript:')) {
              el.removeAttribute('href');
              el.removeAttribute('xlink:href');
            }
          });
          wrapper.appendChild(doc.documentElement);
          pre.parentNode.replaceChild(wrapper, pre);
        }).catch(function(err) {
          console.error('Mermaid render error:', err);
        });
      } catch (e) {
        console.error('Mermaid error:', e);
      }
    });
  }

  // ── 5. Code block enhancements (line numbers + copy) ──
  function enhanceCodeBlocks() {
    document.querySelectorAll('pre code').forEach(function(block) {
      var pre = block.parentNode;

      // Skip mermaid blocks and already processed blocks
      if (pre.dataset.processed) return;
      if (block.classList.contains('language-mermaid') || block.classList.contains('mermaid')) return;

      pre.dataset.processed = '1';

      // Split content into lines and wrap each in <div class="line">
      var text = block.textContent;
      var lines = text.split('\n');
      // Remove trailing empty line
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      block.innerHTML = '';
      lines.forEach(function(line) {
        var div = document.createElement('div');
        div.className = 'line';
        div.textContent = line;
        block.appendChild(div);
      });

      // Add copy button
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '复制';
      btn.setAttribute('title', '复制代码');
      pre.appendChild(btn);

      btn.addEventListener('click', function() {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function() {
          btn.textContent = '已复制!';
          btn.setAttribute('title', '复制成功');
          setTimeout(function() {
            btn.textContent = '复制';
            btn.setAttribute('title', '复制代码');
          }, 1500);
          }).catch(function() {
            fallbackCopy(text);
          });
        } else {
          fallbackCopy(text);
        }
      });

      function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          btn.textContent = '已复制!';
          setTimeout(function() { btn.textContent = '复制'; }, 1500);
        } catch {
          btn.textContent = '复制失败';
          setTimeout(function() { btn.textContent = '复制'; }, 1500);
        }
        document.body.removeChild(textarea);
      }
    });
  }

  // Run code block enhancements immediately
  enhanceCodeBlocks();

  // Run mermaid rendering now (if already loaded) or expose for later
  renderMermaid();
  window.renderMermaidDiagrams = renderMermaid;

  // If mermaid script hasn't loaded yet, listen for it
  var mermaidScript = document.querySelector('script[src*="mermaid.min.js"]');
  if (mermaidScript) {
    mermaidScript.addEventListener('load', renderMermaid);
  }

  // ── 6. TOC scroll spy ──
  var tocItems = document.querySelectorAll('.toc-item');
  if (tocItems.length > 0) {
    var headingElements = [];
    tocItems.forEach(function(link) {
      var id = link.getAttribute('href');
      if (id && id.startsWith('#')) {
        var el = document.getElementById(id.slice(1));
        if (el) headingElements.push({ link: link, el: el });
      }
    });

    function updateTocActive() {
      var scrollPos = window.pageYOffset + 120;
      var active = null;
      for (var i = headingElements.length - 1; i >= 0; i--) {
        if (headingElements[i].el.offsetTop <= scrollPos) {
          active = headingElements[i].link;
          break;
        }
      }
      tocItems.forEach(function(link) {
        link.classList.toggle('active', link === active);
      });
    }

    window.addEventListener('scroll', updateTocActive, { passive: true });
    updateTocActive();
  }

  // ── 7. Card stagger animations (triggered on load) ──
  // Animations run on page load for simplicity and accessibility (no JS dependency).
  // IntersectionObserver removed per review: avoids invisible cards when JS is disabled.
})();
