// ======================================
// 1. SVG 데이터 생성 헬퍼 함수
// ======================================
const svg = body =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg"
      width="500" height="280" viewBox="0 0 500 280">
      ${body}
    </svg>`
  )}`;

// ======================================
// 2. 기본 제공 스티커 데이터
// ======================================
export const BUILTIN_STICKERS = {
  
  // 🟢 1. 이모지 캐릭터 (기본)
  emoji: [
    "🐱", "🐰", "🐻", "🐼",
    "🐸", "🐣", "🦊", "🐶",
    "🦄", "🐹", "🎀", "💖"
  ].map(emoji => ({
    id: `emoji-${emoji}`,
    kind: "emoji",
    emoji,
    name: emoji,
    category: "emoji" // 카테고리: 이모지
  })),

  // 🟢 2. 유행어 말풍선 (신규)
  speech: [
    "완전 럭키비키잖아 🍀",
    "폼 미쳤다 🔥",
    "오히려 좋아 😎",
    "이거 실화냐?",
    "오늘도 갓생 ✨",
    "너무 귀여워 💗",
    "그 잡채 💅",
    "레전드 인정",
    "내가 제일 잘 나가",
    "어쩔티비",
    "억울하면 출세하라",
    "궁금하면 500원"
  ].map((text, i) => ({
    id: `speech-${i}`,
    kind: "speech",
    text,
    name: text,
    category: "speech" // 카테고리: 말풍선
  })),

  // 🟢 3. 동물 캐릭터 (SVG 아이콘)
  animal: [
    {
      id: "cat-ears",
      kind: "image",
      name: "분홍 고양이 귀",
      category: "animal", // 카테고리: 동물 귀
      src: svg(`
        <path
          d="M35 245 Q25 120 105 15
             Q160 20 225 190
             Q250 195 275 190
             Q335 20 395 15
             Q475 125 465 245"
          fill="#fff2f8"
          stroke="#7d5368"
          stroke-width="14"
          stroke-linejoin="round"
        />
        <path
          d="M70 190 L112 65 L187 186 Z
             M312 186 L388 65 L432 190 Z"
          fill="#ff98bc"
        />
      `)
    },
    {
      id: "rabbit-ears",
      kind: "image",
      name: "토끼 귀",
      category: "animal",
      src: svg(`
        <ellipse cx="155" cy="118" rx="60" ry="112"
          transform="rotate(-13 155 118)"
          fill="white" stroke="#9c758c" stroke-width="11"/>
        <ellipse cx="340" cy="118" rx="60" ry="112"
          transform="rotate(13 340 118)"
          fill="white" stroke="#9c758c" stroke-width="11"/>
        <ellipse cx="155" cy="118" rx="29" ry="82"
          transform="rotate(-13 155 118)"
          fill="#ffb5d1"/>
        <ellipse cx="340" cy="118" rx="29" ry="82"
          transform="rotate(13 340 118)"
          fill="#ffb5d1"/>
      `)
    },
    {
      id: "bear-ears",
      kind: "image",
      name: "곰 귀",
      category: "animal",
      src: svg(`
        <circle cx="125" cy="135" r="105"
          fill="#a97850" stroke="#714c36" stroke-width="12"/>
        <circle cx="375" cy="135" r="105"
          fill="#a97850" stroke="#714c36" stroke-width="12"/>
        <circle cx="125" cy="135" r="56" fill="#e8b4a4"/>
        <circle cx="375" cy="135" r="56" fill="#e8b4a4"/>
      `)
    },
    {
      id: "cat-whiskers",
      kind: "image",
      name: "고양이 수염",
      category: "whiskers", // 카테고리: 수염
      src: svg(`
        <g stroke="#4b3340" stroke-width="10"
           stroke-linecap="round" fill="none">
          <path d="
            M18 88 L198 118
            M18 150 L198 150
            M28 210 L198 180
            M302 118 L482 88
            M302 150 L482 150
            M302 180 L472 210
          "/>
        </g>
        <path d="M225 93 Q250 77 275 93 Q250 124 225 93"
          fill="#e87999"/>
        <path d="M250 112 Q250 160 223 166
                 M250 112 Q250 160 277 166"
          stroke="#6c4054" stroke-width="8"
          fill="none" stroke-linecap="round"/>
      `)
    },
    {
      id: "puppy-ears",
      kind: "image",
      name: "강아지 귀",
      category: "animal",
      src: svg(`
        <path d="
          M190 200 Q125 280 45 210
          Q-8 140 68 35
          Q140 12 215 120
          M310 200 Q375 280 455 210
          Q508 140 432 35
          Q360 12 285 120
        "
          fill="#b97d55"
          stroke="#76503e"
          stroke-width="12"
          stroke-linejoin="round"/>
        <path d="
          M120 95 Q75 130 88 200
          M380 95 Q425 130 412 200
        "
          fill="none"
          stroke="#e9ae9f"
          stroke-width="25"
          stroke-linecap="round"/>
      `)
    }
  ]
};

// ======================================
// 3. 🟢 카테고리별 스티커 분류 함수 (HTML 렌더링용)
// ======================================
export function getStickersByCategory() {
  return {
    emoji: BUILTIN_STICKERS.emoji,
    animal: BUILTIN_STICKERS.animal.filter(s => s.category === "animal"),
    whiskers: BUILTIN_STICKERS.animal.filter(s => s.category === "whiskers"),
    speech: BUILTIN_STICKERS.speech
  };
}

// ======================================
// 4. 🟢 모든 스티커 평탄화(Flat) - 템플릿 저장/불러오기용
// ======================================
export function getAllBuiltinStickers() {
  return [
    ...BUILTIN_STICKERS.emoji,
    ...BUILTIN_STICKERS.animal,
    ...BUILTIN_STICKERS.speech
  ];
}