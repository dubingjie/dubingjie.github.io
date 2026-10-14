(() => {
  'use strict';
  const script = document.querySelector('script[data-root]');
  const root = script?.dataset.root || '/';
  const storage = {
    get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} },
    remove(key) { try { sessionStorage.removeItem(key); } catch {} }
  };
  const locationKey = location.pathname + location.search;
  // Remember the list only for normal in-tab navigation, including search results.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-post-link]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin) return;
    storage.set('linx-reading-origin', {target: target.pathname, from: locationKey + location.hash, y: scrollY, query: document.querySelector('#search-dialog[open] #search-input')?.value || ''});
  });
  const back = document.querySelector('[data-reading-back]');
  if (back) {
    const origin = storage.get('linx-reading-origin');
    if (origin?.target === location.pathname) {
      try {
        const url = new URL(origin.from, location.origin);
        if (url.origin === location.origin) {
          back.href = url.href;
          back.addEventListener('click', () => storage.set('linx-restore', origin));
        }
      } catch {}
    } else back.href = root;
  }
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const menu = document.querySelector('#site-menu');
  menuToggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  const toc = document.querySelector('#reading-toc');
  const summary = toc?.querySelector('summary');
  if (toc) {
    const wideScreen = window.matchMedia?.('(min-width: 981px)');
    const isWide = () => wideScreen ? wideScreen.matches : window.innerWidth >= 981;
    toc.open = isWide();
    wideScreen?.addEventListener('change', () => { toc.open = isWide(); });
    document.addEventListener('click', event => { if (!isWide() && !toc.contains(event.target)) toc.open = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && toc.open) { toc.open = false; summary.focus(); } });
    toc.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { if (!isWide()) toc.open = false; }));
    const links = [...toc.querySelectorAll('a')];
    const headings = links.map(link => { try { return document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch { return null; } });
    let ticking = false;
    const markCurrent = () => {
      let index = 0;
      headings.forEach((heading, i) => { if (heading && heading.getBoundingClientRect().top <= 130) index = i; });
      links.forEach((link, i) => { if (i === index) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(markCurrent); } }, {passive: true});
    markCurrent();
  }
  const dialog = document.querySelector('#search-dialog');
  const input = document.querySelector('#search-input');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  let searchData, searchRequest;
  let latestSearch = 0;
  let lastTrigger;
  function openSearch(trigger) { if (!dialog) return; lastTrigger = trigger; if (!dialog.open) dialog.showModal(); input.focus(); }
  document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', () => openSearch(button)));
  document.querySelector('[data-close-search]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog?.addEventListener('close', () => lastTrigger?.focus());
  async function search() {
    const request = ++latestSearch;
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) { status.textContent = '输入关键词，查找标题和正文。'; return; }
    status.textContent = '正在查找…';
    try {
      if (!searchData) {
        searchRequest ||= fetch(script.dataset.search).then(response => { if (!response.ok) throw new Error('search'); return response.json(); });
        searchData = await searchRequest;
      }
      if (request !== latestSearch || input.value.trim() !== query) return;
      const terms = query.toLocaleLowerCase().split(/\s+/);
      const matches = searchData.filter(post => terms.every(term => (post.title + ' ' + post.content + ' ' + post.tags).toLocaleLowerCase().includes(term)));
      matches.sort((a,b) => Number(b.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) - Number(a.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
      status.textContent = matches.length ? `找到 ${matches.length} 篇笔记` : '没有找到相关笔记，换个关键词试试。';
      matches.forEach(post => {
        const li = document.createElement('li');
        const a = document.createElement('a'); a.href = new URL(post.path, location.origin + root).href; a.dataset.postLink = '';
        const title = document.createElement('strong'); title.textContent = post.title;
        const excerpt = document.createElement('p');
        const index = post.content.toLocaleLowerCase().indexOf(terms[0]);
        const start = Math.max(0, index - 24); excerpt.textContent = (start ? '…' : '') + post.content.slice(start, start + 115) + '…';
        a.append(title, excerpt); li.append(a); results.append(li);
      });
    } catch { searchRequest = null; if (request === latestSearch) status.textContent = '搜索暂时不可用，请稍后重试。'; }
  }
  document.querySelector('#search-form')?.addEventListener('submit', event => { event.preventDefault(); search(); });
  let debounce;
  input?.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(search, 180); });
  window.addEventListener('pageshow', async () => {
    const saved = storage.get('linx-restore');
    if (!saved || saved.from.split('#')[0] !== locationKey) return;
    storage.remove('linx-restore');
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1200))]);
    window.scrollTo({top: saved.y || 0, behavior: 'instant'});
    if (saved.query && dialog) { openSearch(document.querySelector('[data-open-search]')); input.value = saved.query; search(); }
  });
})();
