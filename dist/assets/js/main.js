// Bogl - code block enhancements: line numbers + wrap + copy + mermaid diagrams
(function() {
  'use strict';

  // --- 1. Mermaid diagram rendering ---
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
          wrapper.innerHTML = result.svg;
          pre.parentNode.replaceChild(wrapper, pre);
        }).catch(function(err) {
          console.error('Mermaid render error:', err);
        });
      } catch (e) {
        console.error('Mermaid error:', e);
      }
    });
  }

  // --- 2. Code block enhancements (line numbers + copy) ---
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
      pre.appendChild(btn);

      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = '已复制!';
          setTimeout(function() { btn.textContent = '复制'; }, 1500);
        });
      });
    });
  }

  // Run code block enhancements immediately
  enhanceCodeBlocks();

  // Run mermaid rendering now (if already loaded) or expose for later
  renderMermaid();
  window.renderMermaidDiagrams = renderMermaid;
})();
