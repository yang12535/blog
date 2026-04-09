// Bogl - code block enhancements: line numbers + wrap + copy
(function() {
  'use strict';

  document.querySelectorAll('pre code').forEach(function(block) {
    var pre = block.parentNode;

    // Skip if already processed
    if (pre.dataset.processed) return;
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
      // Preserve leading spaces for indentation
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
})();
