// 캐릭터: 앉아서 위를 올려다보는 러시안블루 고양이 (사용자 고양이 사진을 본떠 그림)
// 수영 앱이라 머리 위에 수경만 살짝 걸쳤다. mood: rest 는 눈 감고 쉬는 얼굴, 그 외는 눈 뜬 얼굴
const FUR = '#7f8a97', FUR_DARK = '#6b7684', FUR_LIGHT = '#98a2ae';

export function cat({ size = 96, mood = 'hello' } = {}) {
  const rest = mood === 'rest';
  const eye = (x) => rest
    ? `<path d="M${x - 5} 47 q5 4 10 0" stroke="#2b3038" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${x}" cy="46" rx="5.8" ry="6.2" fill="#9fdcb4"/><ellipse cx="${x}" cy="45.4" rx="2.2" ry="4.4" fill="#1c2026"/><circle cx="${x + 1.6}" cy="43.6" r="1.4" fill="#fff"/>`;
  const zz = rest ? '<text x="88" y="26" font-size="11" font-weight="700" font-family="sans-serif" fill="#8b95a1">z</text><text x="96" y="16" font-size="8" font-weight="700" font-family="sans-serif" fill="#b0b8c1">z</text>' : '';
  return `<svg class="cat" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
    <ellipse cx="60" cy="113" rx="34" ry="4" fill="#000" opacity="0.06"/>
    <path d="M78 108 C100 110 108 92 100 76 C97 70 92 72 94 78 C99 90 92 101 78 100Z" fill="${FUR_DARK}"/>
    <path d="M37 110 C29 95 35 74 49 62 L71 62 C85 74 91 95 83 110Z" fill="${FUR}"/>
    <path d="M57 82 q3 -3 6 0 q-3 4 -6 0z" fill="#e9edf1" opacity="0.8"/>
    <ellipse cx="51" cy="109" rx="7" ry="4.2" fill="${FUR_LIGHT}"/>
    <ellipse cx="69" cy="109" rx="7" ry="4.2" fill="${FUR_LIGHT}"/>
    <g transform="translate(60 44) scale(1.12) translate(-60 -42)">
    <path d="M37 40 L35 9 L55 26Z" fill="${FUR}"/>
    <path d="M83 40 L85 9 L65 26Z" fill="${FUR}"/>
    <path d="M40 33 L39 15 L51 26Z" fill="#c9a3ab"/>
    <path d="M80 33 L81 15 L69 26Z" fill="#c9a3ab"/>
    <path d="M36 44 C36 29 46 22 60 22 C74 22 84 29 84 44 C84 58 74 68 60 68 C46 68 36 58 36 44Z" fill="${FUR}"/>
    <path d="M37 32 C46 28 74 28 83 32" stroke="#2f6fe0" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="51" cy="29" rx="7" ry="4.6" fill="#b7ef6a" fill-opacity="0.75" stroke="#6cc43a" stroke-width="2"/>
    <ellipse cx="69" cy="29" rx="7" ry="4.6" fill="#b7ef6a" fill-opacity="0.75" stroke="#6cc43a" stroke-width="2"/>
    ${eye(50)}${eye(70)}
    <path d="M57.4 53.5 h5.2 l-2.6 3z" fill="#2b3038"/>
    <path d="M60 56.5 v2 M60 58.5 q-2.6 2.6 -5 0.6 M60 58.5 q2.6 2.6 5 0.6" stroke="#3a3f47" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    ${rest ? '' : '<path d="M56.6 59.2 l1 2.4 l1 -2.1z" fill="#fff"/>'}
    <path d="M42 54 l-14 -2 M42 57 l-14 3 M78 54 l14 -2 M78 57 l14 3" stroke="#dfe4ea" stroke-width="1.1" stroke-linecap="round"/>
    </g>
    ${zz}
  </svg>`;
}
