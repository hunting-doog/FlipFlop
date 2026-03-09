const app = document.getElementById('app');

const adminConfig = {
  // Nome ocultado em base64 e senha armazenada somente em hash bcrypt.
  userKey: 'R3VpaA==',
  passHash: '$2a$10$8JuS58QmDG0kEsDe49x46uWWxU2g6Ac6SqUCp7N4ydqXX0PLwHjK6', // "flipflop-admin"
};

const avatars = [
  '🔘','👽','🐭','🐶','🐰','🐱','🎃','🐕','👾','🦐','🐟','🐸'
];

const state = {
  user: null,
  guest: false,
  screen: 'auth',
  game: null,
  rps: { user: 0, ai: 0, rounds: 0, log: '' },
  ttt: { board: Array(9).fill(''), placedX: [], placedO: [], turn: 'X', scoreX: 0, scoreO: 0 },
};

function db() {
  return JSON.parse(localStorage.getItem('flipflop-users') || '{}');
}
function saveDB(data) {
  localStorage.setItem('flipflop-users', JSON.stringify(data));
}
function getUser(name) {
  return db()[name?.toLowerCase()];
}
function saveUser(user) {
  const data = db();
  data[user.username.toLowerCase()] = user;
  saveDB(data);
}

function computeLevel(xp) {
  return Math.floor(xp / 120) + 1;
}

function render() {
  if (state.screen === 'auth') return renderAuth();
  renderLobby();
}

function renderAuth(message = '') {
  app.innerHTML = `
    <main class="auth-wrap">
      <section class="auth-card">
        <h1>🎮 FlipFlop</h1>
        <p class="small">Login com nome + senha, dark mode por padrão.</p>
        <div class="row">
          <input id="name" placeholder="Nome" />
          <input id="pass" type="password" placeholder="Senha" />
        </div>
        <div class="row" style="margin-top:.7rem;">
          <button id="login">Entrar</button>
          <button id="register" class="ghost">Cadastrar</button>
          <button id="guest" class="ghost">Jogar como Convidado</button>
        </div>
        <p class="${message.startsWith('Erro') ? 'error' : 'message'}">${message}</p>
      </section>
    </main>`;

  document.getElementById('login').onclick = login;
  document.getElementById('register').onclick = register;
  document.getElementById('guest').onclick = () => {
    state.guest = true;
    state.user = {
      username: 'Convidado',
      title: 'Guest',
      avatarId: 0,
      xp: 0,
      coins: 0,
      visual: { theme: 'dark', accent: '#6d7cff' },
      audio: { music: 60, sfx: 80 },
      profile: { renameLeft: 0, keroppi: false },
    };
    state.screen = 'lobby';
    render();
  };
}

function isAdmin(username, password) {
  const decoded = atob(adminConfig.userKey);
  return username === decoded && bcrypt.compareSync(password, adminConfig.passHash);
}

function register() {
  const username = document.getElementById('name').value.trim();
  const password = document.getElementById('pass').value;
  if (!username || password.length < 6) return renderAuth('Erro: nome e senha (mín. 6).');
  if (getUser(username)) return renderAuth('Erro: usuário já existe.');
  const hash = bcrypt.hashSync(password, 10);
  const user = {
    username,
    passwordHash: hash,
    title: 'Jogador',
    avatarId: 0,
    xp: 0,
    coins: 0,
    friends: [],
    visual: { theme: 'dark', accent: '#6d7cff' },
    audio: { music: 60, sfx: 80 },
    profile: { renameLeft: 3, keroppi: false },
  };
  saveUser(user);
  renderAuth('Cadastro criado. Faça login.');
}

function login() {
  const username = document.getElementById('name').value.trim();
  const password = document.getElementById('pass').value;

  if (isAdmin(username, password)) {
    state.user = {
      username: 'Guih',
      title: 'ADM',
      avatarId: 0,
      xp: 9999,
      coins: 9999,
      visual: { theme: 'dark', accent: '#6d7cff' },
      audio: { music: 60, sfx: 80 },
      profile: { renameLeft: 999, keroppi: true },
      admin: true,
    };
    state.screen = 'lobby';
    return render();
  }

  const user = getUser(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return renderAuth('Erro: credenciais inválidas.');
  state.user = user;
  state.guest = false;
  state.screen = 'lobby';
  render();
}

function renderLobby() {
  const level = computeLevel(state.user.xp);
  const titleClass = state.user.title === 'ADM' ? 'rainbow' : (state.user.title.includes('perereco') ? 'title-green' : '');
  app.innerHTML = `
  <div class="container">
    <header class="header panel">
      <div class="logo">FlipFlop</div>
      <input class="search" id="search" placeholder="🔍 Buscar jogos" />
      <button id="friendsBtn" class="ghost">👥 Amigos</button>
      <button id="settingsBtn" class="ghost">⚙️ Config</button>
      <div class="profile-chip"><div class="avatar">${avatars[state.user.avatarId] || '🔘'}</div>
      <div><strong class="${titleClass}">${state.user.username}</strong><div class="small">${state.user.title} · Nv.${level} · 💰${state.user.coins}</div></div></div>
    </header>

    <section class="grid" id="games">
      <article class="panel game-card"><h3>✋ Pedra, Papel, Tesoura</h3><p class="badge">Online / vs IA · 127 online</p><button data-game="rps">Abrir</button></article>
      <article class="panel game-card"><h3>❌ Jogo da Velha Mod.</h3><p class="badge">Online / vs IA · 81 online</p><button data-game="ttt">Abrir</button></article>
      <article class="panel game-card"><h3>🏪 Loja</h3><p class="badge">Em manutenção 🚧</p><button disabled>Em breve</button></article>
    </section>

    <section id="gameArea" class="panel hidden"></section>
    <section id="settings" class="panel hidden"></section>
  </div>`;

  document.querySelectorAll('[data-game]').forEach((el) => el.onclick = () => openGame(el.dataset.game));
  document.getElementById('settingsBtn').onclick = openSettings;
  document.getElementById('friendsBtn').onclick = () => alert('Sistema de amigos: adicionar, convidar, desafiar (MVP visual).');
}

function openGame(game) {
  state.game = game;
  const area = document.getElementById('gameArea');
  area.classList.remove('hidden');
  if (game === 'rps') return renderRPS();
  if (game === 'ttt') return renderTTT();
}

function renderRPS() {
  const { user, ai, rounds, log } = state.rps;
  document.getElementById('gameArea').innerHTML = `
  <h3>✋ Pedra, Papel, Tesoura</h3>
  <div class="game-area">
    <div>⏱️ 3:00 · Placar: ${user} | ${ai} · Rodada ${rounds + 1}/3</div>
    <div class="rps-actions">
      <button class="big" data-move="🪨">🪨</button>
      <button class="big" data-move="📄">📄</button>
      <button class="big" data-move="✂️">✂️</button>
    </div>
    <p>${log || 'Escolha sua jogada.'}</p>
  </div>`;
  document.querySelectorAll('[data-move]').forEach((b) => b.onclick = () => playRPS(b.dataset.move));
}

function playRPS(move) {
  const options = ['🪨', '📄', '✂️'];
  const aiMove = options[Math.floor(Math.random() * 3)];
  const wins = (move === '🪨' && aiMove === '✂️') || (move === '📄' && aiMove === '🪨') || (move === '✂️' && aiMove === '📄');
  if (move !== aiMove) wins ? state.rps.user++ : state.rps.ai++;
  state.rps.rounds++;
  state.rps.log = `Você: ${move} · Oponente: ${aiMove} → ${move === aiMove ? 'Empate' : wins ? 'VITÓRIA 🏆' : 'DERROTA 💀'}`;
  if (state.rps.rounds >= 3) {
    const youWin = state.rps.user >= state.rps.ai;
    state.user.xp += youWin ? 50 : 15;
    state.user.coins += youWin ? 10 : 4;
    persistCurrentUser();
    alert(`${youWin ? '🏆 Você venceu!' : '💀 Você perdeu!'} +${youWin ? 50 : 15} XP e +${youWin ? 10 : 4} moedas`);
    state.rps = { user: 0, ai: 0, rounds: 0, log: '' };
  }
  renderRPS();
}

function renderTTT() {
  const t = state.ttt;
  document.getElementById('gameArea').innerHTML = `
    <h3>❌ Jogo da Velha Modificado</h3>
    <p>Turno: ${t.turn} · Rodadas: X ${t.scoreX} | O ${t.scoreO}</p>
    <div class="ttt">${t.board.map((c, i) => `<button class="cell" data-i="${i}">${c}</button>`).join('')}</div>
    <p class="small">Após 3 peças, move automaticamente a mais antiga.</p>
  `;
  document.querySelectorAll('[data-i]').forEach((btn) => btn.onclick = () => playTTT(Number(btn.dataset.i)));
}

function playTTT(i) {
  const t = state.ttt;
  if (t.board[i]) return;
  const q = t.turn === 'X' ? t.placedX : t.placedO;
  if (q.length >= 3) {
    const old = q.shift();
    t.board[old] = '';
  }
  t.board[i] = t.turn;
  q.push(i);
  const win = checkWin(t.board, t.turn);
  if (win) {
    if (t.turn === 'X') t.scoreX++; else t.scoreO++;
    alert(`${t.turn} venceu o round!`);
    t.board = Array(9).fill(''); t.placedX = []; t.placedO = [];
    if (t.scoreX + t.scoreO >= 3) {
      const youWin = t.scoreX >= t.scoreO;
      state.user.xp += youWin ? 50 : 20;
      state.user.coins += youWin ? 10 : 5;
      persistCurrentUser();
      alert('Fim de partida! Recompensas aplicadas.');
      state.ttt = { board: Array(9).fill(''), placedX: [], placedO: [], turn: 'X', scoreX: 0, scoreO: 0 };
    }
  }
  t.turn = t.turn === 'X' ? 'O' : 'X';
  renderTTT();
}

function checkWin(board, mark) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return lines.some(([a,b,c]) => board[a] === mark && board[b] === mark && board[c] === mark);
}

function openSettings() {
  const panel = document.getElementById('settings');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <h3>⚙️ Configurações</h3>
    <div class="settings">
      <div>
        <strong>Perfil</strong>
        <div class="row"><input id="newName" placeholder="Novo nome"/><button id="rename">Renomear (${state.user.profile.renameLeft}x)</button></div>
        <div class="row"><input id="newPass" type="password" placeholder="Nova senha"/><button id="changePass">Trocar senha</button></div>
        <p>Foto de perfil</p>
        <div class="profile-picker">${avatars.map((a, i) => {
          const lockedKeroppi = i === 11 && !state.user.profile.keroppi;
          const lockedAdmin = state.user.admin ? false : false;
          if (lockedKeroppi || lockedAdmin) return '';
          return `<button class="profile-btn" data-avatar="${i}">${a}</button>`;
        }).join('')}</div>
        <div class="row"><input id="code" placeholder="Inserir código secreto"/><button id="unlock">Desbloquear</button></div>
      </div>
      <div>
        <strong>Áudio</strong>
        <div class="row"><label>Música ${state.user.audio.music}%</label><input id="music" type="range" min="0" max="100" value="${state.user.audio.music}"/></div>
        <div class="row"><label>SFX ${state.user.audio.sfx}%</label><input id="sfx" type="range" min="0" max="100" value="${state.user.audio.sfx}"/></div>
      </div>
      <div>
        <strong>Visual</strong>
        <div class="row"><select id="theme"><option value="dark">Escuro</option><option value="light">Claro</option></select><input id="accent" type="color" value="${state.user.visual.accent}"/></div>
        <button class="warn" id="reset">Restaurar padrão</button>
      </div>
      ${state.user.admin ? '<div><strong>Painel ADM</strong><p>Manutenção de jogos, banimentos e avisos globais (estrutura pronta no MVP).</p></div>' : ''}
    </div>`;

  panel.querySelectorAll('[data-avatar]').forEach((btn) => btn.onclick = () => {
    state.user.avatarId = Number(btn.dataset.avatar);
    persistCurrentUser();
    renderLobby();
    openSettings();
  });

  document.getElementById('rename').onclick = () => {
    if (state.guest) return alert('Convidado não salva progresso.');
    if (state.user.profile.renameLeft <= 0) return alert('Limite atingido.');
    const newName = document.getElementById('newName').value.trim();
    if (!newName) return;
    state.user.profile.renameLeft--;
    state.user.username = newName;
    persistCurrentUser();
    renderLobby();
    openSettings();
  };

  document.getElementById('changePass').onclick = () => {
    if (state.guest) return alert('Convidado não tem senha.');
    const newPass = document.getElementById('newPass').value;
    if (newPass.length < 6) return alert('Senha fraca.');
    state.user.passwordHash = bcrypt.hashSync(newPass, 10);
    persistCurrentUser();
    alert('Senha atualizada.');
  };

  document.getElementById('unlock').onclick = () => {
    const code = document.getElementById('code').value.trim();
    if (code === 'perereco') {
      state.user.profile.keroppi = true;
      state.user.title = '🐸 perereco';
      persistCurrentUser();
      renderLobby();
      openSettings();
    } else alert('Código inválido.');
  };

  document.getElementById('music').oninput = (e) => { state.user.audio.music = Number(e.target.value); persistCurrentUser(); };
  document.getElementById('sfx').oninput = (e) => { state.user.audio.sfx = Number(e.target.value); persistCurrentUser(); };
  document.getElementById('theme').value = state.user.visual.theme;
  document.getElementById('theme').onchange = (e) => { state.user.visual.theme = e.target.value; persistCurrentUser(); };
  document.getElementById('accent').onchange = (e) => { state.user.visual.accent = e.target.value; persistCurrentUser(); document.documentElement.style.setProperty('--accent', e.target.value); };
  document.getElementById('reset').onclick = () => {
    state.user.visual = { theme: 'dark', accent: '#6d7cff' };
    state.user.audio = { music: 60, sfx: 80 };
    persistCurrentUser();
    renderLobby();
    openSettings();
  };
}

function persistCurrentUser() {
  if (state.guest || state.user.admin) return;
  saveUser(state.user);
}

render();
