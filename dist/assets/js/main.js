// Bogl - minimal blog scripts
(function() {
  'use strict';

  // Copy code button for pre blocks
  document.querySelectorAll('pre code').forEach(function(block) {
    var pre = block.parentNode;
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;padding:4px 10px;font-size:12px;background:var(--border);border:none;border-radius:4px;cursor:pointer;color:var(--fg);';
    pre.style.position = 'relative';
    pre.appendChild(btn);
    btn.addEventListener('click', function() {
      navigator.clipboard.writeText(block.textContent).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
      });
    });
  });
})();
