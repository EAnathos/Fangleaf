// Lobby : créer ou rejoindre un village, puis lancer la partie.

import './styles.css';
import { MAX_VILLAGES } from '../../shared/config.ts';
import { authEnabled, currentAccount, type MyVillage, myVillages, signInWithGoogle, signOut } from './auth.ts';
import { startLobbyScene } from './lobbyScene.ts';
import { Net } from './net.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Application installable (PWA) : le service worker, seulement en production (en dev, il gênerait le rechargement à chaud).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => { /* navigateur sans service worker : tant pis */ }));
}
// Pas de menu du clic droit dans le jeu (on le garde dans les champs de texte, pour copier-coller).
addEventListener('contextmenu', (e) => {
  if (!(e.target instanceof HTMLElement && e.target.closest('input, textarea'))) e.preventDefault();
});
const nameInput = $<HTMLInputElement>('name');
const codeInput = $<HTMLInputElement>('code');
let mode: 'mine' | 'create' | 'join' = 'create';
let villages: MyVillage[] = []; // villages du compte (MAX_VILLAGES au plus)
let picked = ''; // « Mes villages » : celui qui est choisi
const full = () => villages.length >= MAX_VILLAGES;

function setMode(m: typeof mode) {
  mode = m;
  for (const t of ['mine', 'create', 'join'] as const) $(`tab-${t}`).setAttribute('aria-selected', String(m === t));
  $('code-field').hidden = m !== 'join';
  $('mine-list').hidden = m !== 'mine';
  $('mine-leave').hidden = m !== 'mine' || !picked;
  askLeave(false);
  $('create-hint').hidden = m !== 'create';
  const hint = $('mine-hint');
  hint.hidden = !full() || m === 'mine'; // seulement quand on ne peut plus fonder ni rejoindre
  hint.textContent = `Tu as déjà ${MAX_VILLAGES} villages : quittes-en un (Mes villages › Quitter ce village) pour en ${m === 'create' ? 'fonder' : 'rejoindre'} un autre.`;
  $('create-hint').hidden ||= full();
  const go = $<HTMLButtonElement>('go');
  go.disabled = m === 'create' && full();
  go.textContent = m === 'mine' ? 'Entrer dans le village' : m === 'join' ? 'Rejoindre le village' : 'Fonder le village';
  $('lobby-error').textContent = '';
}

/** Quitter le village choisi : d'abord une confirmation (sa progression y est effacée). */
function askLeave(on: boolean) {
  $('leave-ask').hidden = on;
  $('leave-confirm').hidden = !on;
  $<HTMLButtonElement>('leave-go').disabled = false;
  if (!on) return;
  const v = villages.find((x) => x.code === picked);
  $('leave-text').textContent = `Quitter « ${v?.village || 'Sans nom'} » ? Ta progression y sera effacée (or, équipement, essences, Alphas). Le village continue pour ses autres membres ; s'il n'en reste aucun, il disparaît.`;
}

/** Envoie la demande au serveur (le client ne peut pas effacer sa progression lui-même). */
async function leavePicked() {
  const code = picked, go = $<HTMLButtonElement>('leave-go');
  go.disabled = true;
  $('lobby-error').textContent = '';
  const account = await currentAccount().catch(() => null);
  if (!account) {
    $('lobby-error').textContent = 'Session expirée : reconnecte-toi.';
    return refreshAccount();
  }
  const net = new Net();
  try {
    await net.ready();
  } catch {
    $('lobby-error').textContent = 'Serveur injoignable. Est-il lancé ?';
    go.disabled = false;
    return;
  }
  const answer = await new Promise<string | null>((done) => {
    net.onMessage = (m) => (m.t === 'left' ? done(null) : m.t === 'error' ? done(m.msg) : undefined);
    net.onClose = () => done('Connexion au serveur perdue.');
    net.send({ t: 'leave', code, token: account.token });
  });
  net.onClose = () => {};
  net.close();
  if (answer) {
    $('lobby-error').textContent = answer;
    go.disabled = false;
    return;
  }
  villages = villages.filter((v) => v.code !== code);
  picked = '';
  renderVillages();
  setMode(villages.length ? 'mine' : 'create');
  $('card-title').textContent = villages.length ? 'Tes villages' : 'Ton premier village';
}
$('leave-ask').onclick = () => askLeave(true);
$('leave-cancel').onclick = () => askLeave(false);
$('leave-go').onclick = () => void leavePicked();

/** « il y a 3 jours » : date de la dernière partie dans ce village. */
function since(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return Number.isNaN(days) ? '' : days <= 0 ? 'aujourd\'hui' : days === 1 ? 'hier' : `il y a ${days} jours`;
}

/** Villages du compte : une carte par village (son nom, dernière partie), la plus récente choisie. */
function renderVillages() {
  $('tab-mine').hidden = !villages.length;
  if (!villages.some((v) => v.code === picked)) picked = villages[0]?.code ?? '';
  $('mine-list').replaceChildren(
    ...villages.map((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'village-pick';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(v.code === picked));
      btn.innerHTML = '<b></b><span class="when"></span>';
      // le nom du village (« Sans nom » tant que l'Hôtel de ville ne l'a pas baptisé)
      const b = btn.querySelector('b')!;
      b.textContent = v.village || 'Sans nom';
      b.classList.toggle('unnamed', !v.village);
      btn.querySelector('.when')!.textContent = since(v.updated);
      btn.onclick = () => {
        picked = v.code;
        renderVillages();
        setMode('mine');
      };
      btn.ondblclick = () => $<HTMLFormElement>('lobby-form').requestSubmit();
      return btn;
    }),
  );
}

try {
  nameInput.value = localStorage.getItem('fangleaf.name') ?? '';
} catch { /* stockage indisponible */ }

startLobbyScene($<HTMLCanvasElement>('lobby-scene'), () => !$('lobby').hidden);

// Le jeu (carte, HUD, son…) est un module à part : le lobby s'affiche sans l'attendre,
// puis on le télécharge en arrière-plan pour qu'il soit prêt au moment de jouer.
let gameModule: Promise<typeof import('./game.ts')> | null = null;
const loadGame = () => (gameModule ??= import('./game.ts'));
if ('requestIdleCallback' in window) requestIdleCallback(() => void loadGame());
else setTimeout(() => void loadGame(), 1500);

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
$('tab-mine').onclick = () => setMode('mine');
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
  villages = acc ? await myVillages().catch(() => []) : [];
  $('google').hidden = !!acc;
  $('guest-note').hidden = true; // « Chargement… » : plus utile une fois le compte connu
  $('signed-in').hidden = !acc;
  $('card-title').textContent = acc ? (invited ? 'Rejoindre le village' : villages.length ? 'Tes villages' : 'Ton premier village') : 'Rejoins la meute';
  renderVillages();
  // déjà des villages : on propose d'y retourner (la progression y est rattachée), ou d'en fonder / rejoindre un autre
  if (!invited) setMode(villages.length ? 'mine' : 'create');
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
  if (mode === 'mine' && !picked) return;
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
  let Game: (typeof import('./game.ts'))['Game'];
  try {
    // le jeu doit être chargé avant d'entrer : le serveur enchaîne « welcome » et la position de départ
    [{ Game }] = await Promise.all([loadGame(), net.ready()]);
  } catch {
    $('lobby-error').textContent = 'Serveur injoignable. Est-il lancé ?';
    go.disabled = false;
    return;
  }
  // Écran de chargement : le serveur génère l'île (création) ou ouvre le village, puis le navigateur la dessine.
  const loading = $('loading');
  const stopLoading = () => (loading.hidden = true);
  $('loading-text').textContent = mode === 'create' ? 'L\'île se forme' : 'En route vers le village';
  $('loading-sub').textContent = mode === 'create' ? 'Les vagues dessinent ses côtes, les forêts y poussent, les monstres s\'y installent.' : 'On rejoint l\'île et ses dompteurs.';
  loading.classList.remove('done');
  loading.hidden = false;
  net.onMessage = (m) => {
    if (m.t === 'error') {
      stopLoading();
      $('lobby-error').textContent = m.msg;
      if (m.msg.startsWith('Aucun village')) $('village-tabs').hidden = false; // village introuvable : autre choix
      go.disabled = false;
      net.close();
    } else if (m.t === 'welcome') {
      $('lobby').hidden = true;
      history.replaceState(null, '', location.pathname); // invitation consommée : pas de badge au rechargement
      const game = new Game($<HTMLCanvasElement>('game'), net, m.id, m.code, m.seed, m.villageFound, m.founder, m.armed);
      if (import.meta.env.DEV) Object.assign(window, { game }); // debug console
      // l'île est prête : l'écran de chargement s'efface une fois la première image dessinée
      requestAnimationFrame(() => {
        loading.classList.add('done');
        setTimeout(stopLoading, 500);
      });
    }
  };
  net.onClose = () => {
    if (!$('lobby').hidden) {
      stopLoading(); // coupé avant d'entrer : on reste au lobby
      $('lobby-error').textContent ||= 'Connexion au serveur perdue.';
      go.disabled = false;
    } else {
      alert('Connexion au serveur perdue.');
      location.reload();
    }
  };
  net.send(mode === 'create' ? { t: 'create', name, token } : { t: 'join', code: mode === 'mine' ? picked : codeInput.value, name, token });
});
