// Lobby : créer ou rejoindre un village, puis lancer la partie.

import './styles.css';
import { authEnabled, currentAccount, lastVillage, signInWithGoogle, signOut } from './auth.ts';
import { Game } from './game.ts';
import { startLobbyScene } from './lobbyScene.ts';
import { Net } from './net.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const nameInput = $<HTMLInputElement>('name');
const codeInput = $<HTMLInputElement>('code');
let mode: 'create' | 'join' = 'create';

function setMode(m: typeof mode) {
  mode = m;
  $('tab-create').setAttribute('aria-selected', String(m === 'create'));
  $('tab-join').setAttribute('aria-selected', String(m === 'join'));
  $('code-field').hidden = m !== 'join';
  $('create-hint').hidden = m !== 'create';
  $('go').textContent = m === 'join' ? 'Rejoindre le village' : 'Fonder le village';
  $('lobby-error').textContent = '';
}

try {
  nameInput.value = localStorage.getItem('fangleaf.name') ?? '';
} catch { /* stockage indisponible */ }

startLobbyScene($<HTMLCanvasElement>('lobby-scene'), () => !$('lobby').hidden);

const invited = new URLSearchParams(location.search).get('v')?.toUpperCase().slice(0, 6) || null;

/** Un village précis à rejoindre (invitation ou son propre village) : juste le bouton « Rejoindre le village ». */
function focusVillage(code: string, label: string) {
  codeInput.value = code;
  setMode('join');
  $('village-tabs').hidden = true;
  $('code-field').hidden = true;
  $('invite-badge').hidden = false;
  $('invite-label').textContent = label;
  $('invite-code').textContent = code;
}
if (invited) focusVillage(invited, 'Invitation au village');
$('tab-create').onclick = () => setMode('create');
$('tab-join').onclick = () => setMode('join');
codeInput.addEventListener('input', () => (codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));
(nameInput.value ? (invited && !codeInput.value ? codeInput : $('go')) : nameInput).focus();

// Compte Google (si Supabase est configuré).
// Compte obligatoire : le formulaire de jeu n'apparaît qu'une fois connecté.
async function refreshAccount() {
  if (!authEnabled) {
    $('google').hidden = true;
    $('guest-note').textContent = 'Connexion indisponible : Supabase n\'est pas configuré sur ce serveur.';
    return;
  }
  // Rien n'est affiché tant qu'on ne sait pas qui est connecté et quel est son village :
  // sinon on voit un instant « fonder un village » alors qu'on devrait juste rejoindre le sien.
  $('play').hidden = true;
  const acc = await currentAccount().catch(() => null);
  const mine = acc && !invited ? await lastVillage().catch(() => null) : null;
  $('google').hidden = !!acc;
  $('guest-note').hidden = true; // « Chargement… » : plus utile une fois le compte connu
  $('signed-in').hidden = !acc;
  $('card-title').textContent = acc ? (mine || invited ? 'Rejoindre le village' : 'Ton premier village') : 'Rejoins la meute';
  if (mine) focusVillage(mine, 'Ton village'); // déjà un village : on y retourne, la progression y est rattachée
  $('play').hidden = !acc;
  if (acc) {
    $('account-name').textContent = acc.name;
    if (!nameInput.value) nameInput.value = acc.name.split(' ')[0].slice(0, 16);
  }
}
$('google').onclick = () => signInWithGoogle().catch(() => ($('lobby-error').textContent = 'Connexion Google impossible.'));
$('logout').onclick = () => signOut().then(refreshAccount);
// Message laissé par la partie précédente (village supprimé, progression effacée), affiché une fois le lobby prêt.
void refreshAccount().finally(() => {
  try {
    const notice = sessionStorage.getItem('fangleaf.notice');
    if (!notice) return;
    sessionStorage.removeItem('fangleaf.notice');
    $('lobby-error').textContent = notice;
  } catch { /* stockage indisponible */ }
});

$('lobby-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return nameInput.focus();
  if (mode === 'join' && codeInput.value.length !== 6) {
    $('lobby-error').textContent = 'Le code fait 6 caractères.';
    return codeInput.focus();
  }
  try {
    localStorage.setItem('fangleaf.name', name);
  } catch { /* ignore */ }

  const go = $<HTMLButtonElement>('go');
  go.disabled = true;
  $('lobby-error').textContent = '';
  const account = await currentAccount().catch(() => null);
  if (!account) {
    $('lobby-error').textContent = 'Session expirée : reconnecte-toi.';
    return refreshAccount();
  }
  const token = account.token;
  const net = new Net();
  try {
    await net.ready();
  } catch {
    $('lobby-error').textContent = 'Serveur injoignable. Est-il lancé ?';
    go.disabled = false;
    return;
  }
  net.onMessage = (m) => {
    if (m.t === 'error') {
      $('lobby-error').textContent = m.msg;
      if (m.msg.startsWith('Aucun village')) $('village-tabs').hidden = false; // village introuvable : autre choix
      go.disabled = false;
      net.close();
    } else if (m.t === 'welcome') {
      $('lobby').hidden = true;
      history.replaceState(null, '', location.pathname); // invitation consommée : pas de badge au rechargement
      const game = new Game($<HTMLCanvasElement>('game'), net, m.id, m.code, m.seed, m.villageFound, m.founder);
      if (import.meta.env.DEV) Object.assign(window, { game }); // debug console
    }
  };
  net.onClose = () => {
    if ($('lobby').hidden) {
      alert('Connexion au serveur perdue.');
      location.reload();
    }
  };
  net.send(mode === 'create' ? { t: 'create', name, token } : { t: 'join', code: codeInput.value, name, token });
});
