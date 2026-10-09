// 캐릭터: 검은 수영모 + 초록 수경을 쓴 회색 고양이 (사용자 고양이 사진을 본떠 그림)
// mood: hello·happy·cheer·swim·proud 는 눈을 뜬 얼굴, rest 는 눈 감고 쉬는 얼굴
export function cat({ size = 72, mood = 'happy' } = {}) {
  const rest = mood === 'rest';
  const eye = (x) => rest
    ? `<path d="M${x - 7} 63 q7 6 14 0" stroke="#2b2f36" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="63" r="8.5" fill="#d9e8a8"/><circle cx="${x}" cy="63.5" r="6" fill="#1d2127"/><circle cx="${x + 2.4}" cy="60.6" r="2.1" fill="#fff"/>`;
  const sparkle = mood === 'proud'
    ? '<path d="M104 18l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#ffc94d"/><path d="M14 30l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z" fill="#ffc94d"/>'
    : '';
  return `<svg class="cat" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
    ${sparkle}
    <path d="M22 50 L16 22 L42 34Z M98 50 L104 22 L78 34Z" fill="#8d96a0" stroke="#8d96a0" stroke-width="4" stroke-linejoin="round"/>
    <path d="M24 44 L21 29 L35 36Z M96 44 L99 29 L85 36Z" fill="#e8b4b8"/>
    <ellipse cx="60" cy="72" rx="44" ry="38" fill="#8d96a0"/>
    <ellipse cx="60" cy="90" rx="26" ry="18" fill="#a3abb4"/>
    <path d="M17 62 C17 30 36 16 60 16 C84 16 103 30 103 62 C92 52 78 48 60 48 C42 48 28 52 17 62Z" fill="#23272e"/>
    <path d="M34 30 C42 23 52 21 60 21" stroke="#4a515b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="12" y="58" width="12" height="9" rx="3" fill="#2f6fe0"/>
    <rect x="96" y="58" width="12" height="9" rx="3" fill="#2f6fe0"/>
    <ellipse cx="41" cy="63" rx="17" ry="14" fill="#b7ef6a" fill-opacity="0.55" stroke="#77cc33" stroke-width="4"/>
    <ellipse cx="79" cy="63" rx="17" ry="14" fill="#b7ef6a" fill-opacity="0.55" stroke="#77cc33" stroke-width="4"/>
    ${eye(41)}${eye(79)}
    <path d="M55 58 h10 l-2 5 l2 5 h-10 l2 -5z" fill="#2f6fe0"/>
    <path d="M56 80 h8 q0 5 -4 6 q-4 -1 -4 -6z" fill="#4a4f58"/>
    <path d="M60 86 v3 M60 89 q-4 4 -8 1 M60 89 q4 4 8 1" stroke="#4a4f58" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M30 84 l-18 -3 M30 89 l-18 2 M90 84 l18 -3 M90 89 l18 2" stroke="#e9edf1" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;
}
