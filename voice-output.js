 'use strict';
(() => {
  const speech = window.speechSynthesis;
  if (!speech || !('SpeechSynthesisUtterance' in window)) return;

  let activeButton = null;
  let activeArticle = null;
  const style = document.createElement('style');
  style.textContent = '.listen-reply{color:var(--muted);font-size:11px;padding:5px 8px;border-radius:7px;margin-left:8px}.listen-reply:hover,.listen-reply[aria-pressed=true]{color:var(--text);background:var(--hover)}';
  document.head.append(style);

  function stop() {
    speech.cancel();
    if (activeButton?.isConnected) {
      activeButton.textContent = '◖ Yanıtı dinle';
      activeButton.setAttribute('aria-pressed', 'false');
    }
    activeButton = null;
    activeArticle = null;
  }

  function addButton(article) {
    if (!article.matches('.message.assistant') || article.classList.contains('pending') || article.querySelector('.listen-reply')) return;
    const content = article.querySelector('.message-content');
    const copy = article.querySelector('.copy');
    if (!content || !copy) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listen-reply';
    button.textContent = '◖ Yanıtı dinle';
    button.setAttribute('aria-label', 'Aivora yanıtını sesli dinle');
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (activeButton === button) { stop(); return; }
      stop();
      const text = content.innerText.trim();
      if (!text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.onend = utterance.onerror = () => { if (activeButton === button) stop(); };
      activeButton = button;
      activeArticle = article;
      button.textContent = '■ Durdur';
      button.setAttribute('aria-pressed', 'true');
      speech.speak(utterance);
    });
    copy.insertAdjacentElement('afterend', button);
  }

  const messages = document.querySelector('#messages');
  if (!messages) return;
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node === activeArticle || node.contains?.(activeArticle)) stop();
      }
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches('.message.assistant')) addButton(node);
        node.querySelectorAll?.('.message.assistant').forEach(addButton);
      }
    }
  });
  observer.observe(messages, { childList: true, subtree: true });
  messages.querySelectorAll('.message.assistant').forEach(addButton);
})();
