/* Zemi – Manga-DJ-Girl, das mit einer Punktetafel über den Bildschirm tanzt. */
'use strict';

const ZEMI_SVG = `
<svg class="zemi-figure" viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="zemi-hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8b4dff"/><stop offset="1" stop-color="#ff2bd6"/>
    </linearGradient>
    <linearGradient id="zemi-iris" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a1466"/><stop offset=".6" stop-color="#b43cff"/><stop offset="1" stop-color="#ff7ae6"/>
    </linearGradient>
  </defs>
  <g stroke="#23123a" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <!-- lange Zöpfe mit Farbverlauf -->
    <path class="zemi-tail zemi-tail-l" d="M38 44 Q20 62 24 96 Q27 124 18 146 Q34 132 36 104 Q38 78 44 58 Z" fill="url(#zemi-hair)"/>
    <path class="zemi-tail zemi-tail-r" d="M82 44 Q100 62 96 96 Q93 124 102 146 Q86 132 84 104 Q82 78 76 58 Z" fill="url(#zemi-hair)"/>
    <!-- Beine: Leggings und Plateau-Sneaker -->
    <g class="zemi-leg zemi-leg-l">
      <rect x="48" y="150" width="9" height="30" fill="#2a2150"/>
      <path d="M43 178 h16 v9 h-18 Z" fill="#ffffff"/>
      <rect x="41" y="186" width="19" height="6" rx="2" fill="#b6ff3b"/>
    </g>
    <g class="zemi-leg zemi-leg-r">
      <rect x="63" y="150" width="9" height="30" fill="#2a2150"/>
      <path d="M61 178 h16 v9 h-18 Z" fill="#ffffff"/>
      <rect x="60" y="186" width="19" height="6" rx="2" fill="#b6ff3b"/>
    </g>
    <!-- Arme in Jackenärmeln halten die Tafel -->
    <path d="M46 100 L30 62 L25 9" fill="none" stroke-width="12"/>
    <path d="M74 100 L90 62 L95 9" fill="none" stroke-width="12"/>
    <path d="M46 100 L30 62 L25 9" fill="none" stroke="#00d9ff" stroke-width="7"/>
    <path d="M74 100 L90 62 L95 9" fill="none" stroke="#00d9ff" stroke-width="7"/>
    <circle cx="25" cy="8" r="5.5" fill="#ffe0cc"/>
    <circle cx="95" cy="8" r="5.5" fill="#ffe0cc"/>
    <!-- Faltenrock (knielang) -->
    <path d="M44 128 L76 128 L86 156 L34 156 Z" fill="#3b2a7a"/>
    <path d="M45 140 L42 156 M52 131 L50 156 M60 131 L60 156 M68 131 L70 156 M75 140 L78 156" fill="none" stroke-width="1.4" stroke="#6b56c9"/>
    <path d="M34 156 L86 156" fill="none" stroke="#ff2bd6" stroke-width="3"/>
    <!-- Bomberjacke über T-Shirt -->
    <path d="M44 92 L76 92 L79 130 L41 130 Z" fill="#00d9ff"/>
    <path d="M52 92 L68 92 L66 130 L54 130 Z" fill="#ff2bd6"/>
    <path d="M60 104 l2.4 5 5.4.6 -4 3.7 1.1 5.3 -4.9-2.7 -4.9 2.7 1.1-5.3 -4-3.7 5.4-.6 Z" fill="#ffd400" stroke-width="1.2"/>
    <rect x="41" y="126" width="38" height="5" rx="2" fill="#0092b3"/>
    <!-- Kopfhörer um den Hals -->
    <path d="M47 90 Q60 100 73 90" fill="none" stroke="#ff2bd6" stroke-width="4"/>
    <ellipse cx="46" cy="91" rx="5" ry="6.5" fill="#ff2bd6"/>
    <ellipse cx="74" cy="91" rx="5" ry="6.5" fill="#ff2bd6"/>
    <!-- Kopf (Manga-Proportionen) -->
    <rect x="55" y="78" width="10" height="10" fill="#ffe0cc" stroke="none"/>
    <path d="M38 52 Q38 28 60 28 Q82 28 82 52 Q82 72 60 84 Q38 72 38 52 Z" fill="#ffe0cc"/>
    <!-- Pony mit Strähnen -->
    <path d="M36 52 Q34 24 60 22 Q86 24 84 52 L80 43 L75 46 L69 37 L63 44 L57 37 L51 44 L45 42 L40 50 Z" fill="url(#zemi-hair)"/>
    <path d="M48 30 Q56 26 64 28" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>
    <!-- Haarspange (Stern) -->
    <path d="M78 30 l2 4.2 4.6.5 -3.4 3.1 1 4.5 -4.2-2.3 -4.2 2.3 1-4.5 -3.4-3.1 4.6-.5 Z" fill="#b6ff3b" stroke-width="1.2"/>
    <!-- Manga-Augen: links offen, rechts zwinkert -->
    <g stroke="none">
      <ellipse cx="50" cy="59" rx="6" ry="8" fill="url(#zemi-iris)"/>
      <ellipse cx="50" cy="61" rx="2.8" ry="3.8" fill="#23123a"/>
      <circle cx="52.5" cy="55.5" r="2.4" fill="#fff"/>
      <circle cx="47.6" cy="63.5" r="1.2" fill="#fff"/>
    </g>
    <path d="M42 54 Q49 48.5 57 51.5" fill="none" stroke-width="2.8"/>
    <g class="zemi-wink">
      <g stroke="none">
        <ellipse cx="70" cy="59" rx="6" ry="8" fill="url(#zemi-iris)"/>
        <ellipse cx="70" cy="61" rx="2.8" ry="3.8" fill="#23123a"/>
        <circle cx="72.5" cy="55.5" r="2.4" fill="#fff"/>
        <circle cx="67.6" cy="63.5" r="1.2" fill="#fff"/>
      </g>
      <path d="M63 51.5 Q71 48.5 78 54" fill="none" stroke-width="2.8"/>
    </g>
    <!-- Wangen, Nase, Lächeln -->
    <g stroke="none">
      <ellipse cx="44" cy="69" rx="4" ry="2" fill="#ff8fc8" opacity=".75"/>
      <ellipse cx="76" cy="69" rx="4" ry="2" fill="#ff8fc8" opacity=".75"/>
    </g>
    <path d="M60 66 l-1 2.4" fill="none" stroke-width="1.4"/>
    <path d="M55 72 Q60 77.5 65 72 Z" fill="#e0245e" stroke-width="1.8"/>
  </g>
</svg>`;

// Zemi läuft einmal quer über den Bildschirm; big = große Zahl/Text, small = Zeile darunter
function showZemi(big, small = '') {
  if (!state.settings.zemi) return;
  document.querySelector('.zemi')?.remove();
  const el = document.createElement('div');
  el.className = 'zemi';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="zemi-bounce">
      <div class="zemi-sign"><b>${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ''}</div>
      ${ZEMI_SVG}
      <span class="zemi-spark s1">✦</span><span class="zemi-spark s2">✦</span><span class="zemi-spark s3">✦</span>
    </div>`;
  el.addEventListener('animationend', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
}
