(() => {
  const listEl = document.getElementById('game-list');
  const searchEl = document.getElementById('search');
  const emptyState = document.getElementById('empty-state');
  const detailEl = document.getElementById('game-detail');
  const infoPage = document.getElementById('info-page');
  const infoContent = document.getElementById('info-content');
  const navInfo = document.getElementById('nav-info');

  const heroBanner = document.getElementById('hero-banner');
  const heroLogo = document.getElementById('hero-logo');
  const playBtn = document.getElementById('play-btn');
  const playLabel = document.getElementById('play-label');
  const statusText = document.getElementById('status-text');
  const descEl = document.getElementById('game-description');
  const devEl = document.getElementById('game-developer');
  const genreEl = document.getElementById('game-genre');

  let games = [];
  let selectedId = null;

  // Tracks open game windows: { [gameId]: windowRef }
  const openWindows = {};

  function loadGames() {
    fetch('games.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load games.json (' + res.status + ')');
        return res.json();
      })
      .then(data => {
        games = data;
        renderList(games);
        showInfoPage();
      })
      .catch(err => {
        listEl.innerHTML = `<div class="no-results">Couldn't load games.json.<br>${escapeHtml(err.message)}<br><br>If you opened this file directly (file://), run a local server instead, e.g.<br><code>python3 -m http.server</code></div>`;
        console.error(err);
      });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderList(list) {
    listEl.innerHTML = '';

    if (!list.length) {
      listEl.innerHTML = '<div class="no-results">No games match your search.</div>';
      return;
    }

    list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(game => {
        const row = document.createElement('div');
        row.className = 'game-row';
        row.dataset.id = game.id;
        if (game.id === selectedId) row.classList.add('active');
        if (openWindows[game.id] && !openWindows[game.id].closed) row.classList.add('playing');

        row.innerHTML = `
          <img src="${game.icon}" alt="">
          <div class="row-text">
            <span class="row-name">${escapeHtml(game.name)}</span>
            <span class="row-status">${openWindows[game.id] && !openWindows[game.id].closed ? 'Running' : escapeHtml(game.genre || '')}</span>
          </div>
        `;

        row.addEventListener('click', () => selectGame(game.id));
        listEl.appendChild(row);
      });
  }

  function showInfoPage() {
    selectedId = null;
    detailEl.classList.add('hidden');
    emptyState.classList.add('hidden');
    infoPage.classList.remove('hidden');
    highlightActiveRow();
    loadInfoMarkdown();
  }

  let infoLoaded = false;
  function loadInfoMarkdown() {
    if (infoLoaded) return; // cache, no need to refetch every visit
    fetch('assets/info.md')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load assets/info.md (' + res.status + ')');
        return res.text();
      })
      .then(md => {
        infoContent.innerHTML = markdownToHtml(md);
        infoLoaded = true;
      })
      .catch(err => {
        infoContent.innerHTML = `<p class="md-error">Couldn't load assets/info.md.<br>${escapeHtml(err.message)}<br><br>If you opened this file directly (file://), run a local server instead, e.g.<br><code>python3 -m http.server</code></p>`;
        console.error(err);
      });
  }

  // Small, dependency-free Markdown -> HTML converter.
  // Supports: headings (#..###), bold, italic, inline code, links,
  // unordered lists, horizontal rules, and paragraphs.
  function markdownToHtml(md) {
    const escaped = escapeHtml(md);

    const inline = (text) => text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const lines = escaped.split('\n');
    let html = '';
    let inList = false;

    const closeList = () => {
      if (inList) { html += '</ul>'; inList = false; }
    };

    lines.forEach(rawLine => {
      const line = rawLine.trim();

      if (line === '') { closeList(); return; }

      if (/^---+$/.test(line)) { closeList(); html += '<hr>'; return; }

      let m;
      if ((m = line.match(/^### (.*)$/))) { closeList(); html += `<h3>${inline(m[1])}</h3>`; return; }
      if ((m = line.match(/^## (.*)$/)))  { closeList(); html += `<h2>${inline(m[1])}</h2>`; return; }
      if ((m = line.match(/^# (.*)$/)))   { closeList(); html += `<h1>${inline(m[1])}</h1>`; return; }

      if ((m = line.match(/^[-*] (.*)$/))) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inline(m[1])}</li>`;
        return;
      }

      closeList();
      html += `<p>${inline(line)}</p>`;
    });

    closeList();
    return html;
  }

  navInfo.addEventListener('click', showInfoPage);

  function selectGame(id) {
    selectedId = id;
    const game = games.find(g => g.id === id);
    if (!game) return;

    infoPage.classList.add('hidden');
    emptyState.classList.add('hidden');
    detailEl.classList.remove('hidden');

    heroBanner.src = game.banner;
    heroBanner.alt = game.name;
    heroLogo.src = game.logo;
    heroLogo.alt = game.name;
    descEl.textContent = game.description || '';
    devEl.textContent = game.developer || '\u2014';
    genreEl.textContent = game.genre || '\u2014';

    updatePlayButton(game);
    highlightActiveRow();
  }

  function highlightActiveRow() {
    document.querySelectorAll('.game-list .game-row').forEach(row => {
      row.classList.toggle('active', row.dataset.id === selectedId);
    });
    navInfo.classList.toggle('active', selectedId === null);
  }

  function isRunning(id) {
    const win = openWindows[id];
    return !!(win && !win.closed);
  }

  function updatePlayButton(game) {
    if (isRunning(game.id)) {
      playBtn.classList.add('playing');
      playLabel.textContent = 'STOP';
      statusText.textContent = 'Running';
      statusText.classList.add('live');
    } else {
      playBtn.classList.remove('playing');
      playLabel.textContent = 'PLAY';
      statusText.textContent = 'Ready to launch';
      statusText.classList.remove('live');
    }
  }

  playBtn.addEventListener('click', () => {
    const game = games.find(g => g.id === selectedId);
    if (!game) return;

    if (isRunning(game.id)) {
      // STOP: close the game window
      openWindows[game.id].close();
      delete openWindows[game.id];
    } else {
      // PLAY: open the game's url as a new "game" window
      const win = window.open(
        game.url,
        'game_' + game.id,
        'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
      );
      if (win) {
        openWindows[game.id] = win;
      } else {
        statusText.textContent = 'Popup blocked \u2014 allow popups for this page';
        return;
      }
    }

    updatePlayButton(game);
    renderList(filterGames(searchEl.value));
  });

  // Poll to detect windows closed by the user (e.g. clicking the OS window's X)
  setInterval(() => {
    let changed = false;
    Object.keys(openWindows).forEach(id => {
      if (openWindows[id].closed) {
        delete openWindows[id];
        changed = true;
      }
    });
    if (changed) {
      const game = games.find(g => g.id === selectedId);
      if (game) updatePlayButton(game);
      renderList(filterGames(searchEl.value));
    }
  }, 800);

  function filterGames(query) {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.genre || '').toLowerCase().includes(q) ||
      (g.developer || '').toLowerCase().includes(q)
    );
  }

  searchEl.addEventListener('input', () => {
    renderList(filterGames(searchEl.value));
  });

  loadGames();
})();
