import {
  hydratePersona,
  processBehavior,
  loadPrototypePatterns,
  type PersonaSeed,
  type PersonaState,
  type BehaviorRequest,
  type BehaviorResponse,
  type EventCategory,
} from "soul-core";

// --- Persona Seeds ---

const SEEDS: Record<string, PersonaSeed> = {
  warrior: {
    version: 1,
    id: "warrior-001",
    name: "Kael",
    bigFive: [0.3, 0.8, 0.6, 0.4, 0.7],
    coreValues: ["loyalty", "justice", "survival"],
    selfConcept: "I am a protector of the weak",
    roles: ["warrior", "guardian"],
    temperament: { valence: -0.1, arousal: 0.5 },
    relationships: [
      {
        targetId: "ally-001",
        tags: ["ally", "friend"],
        trust: 0.8,
        affection: 0.7,
      },
    ],
    wounds: [
      {
        label: "betrayal",
        trigger: "betrayal or backstabbing",
        sensitivity: 0.8,
        emotionalResponse: "anger",
      },
    ],
  },
  scholar: {
    version: 1,
    id: "scholar-001",
    name: "Lyra",
    bigFive: [0.9, 0.6, 0.3, 0.7, 0.3],
    coreValues: ["curiosity", "compassion", "freedom"],
    selfConcept: "I seek truth above all",
    roles: ["scholar", "healer"],
    temperament: { valence: 0.2, arousal: 0.3 },
  },
  rogue: {
    version: 1,
    id: "rogue-001",
    name: "Vex",
    bigFive: [0.5, 0.3, 0.7, 0.2, 0.8],
    coreValues: ["freedom", "survival", "cunning"],
    selfConcept: "Trust no one but yourself",
    roles: ["rogue", "thief"],
    temperament: { valence: -0.2, arousal: 0.6 },
    wounds: [
      {
        label: "abandonment",
        trigger: "being left behind or abandoned",
        sensitivity: 0.7,
        emotionalResponse: "fear",
      },
    ],
  },
};

// --- App State ---

let currentPersonaKey = "warrior";
let state: PersonaState = hydratePersona(SEEDS.warrior);
let tick = 0;
let history: {
  tick: number;
  response: BehaviorResponse;
  narration?: string;
}[] = [];

// --- Init ---

loadPrototypePatterns();

// --- DOM References ---

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;

const personaBtns =
  document.querySelectorAll<HTMLButtonElement>(".persona-btn");
const personaInfo = $("#persona-info");
const eventCategory = $<HTMLSelectElement>("#event-category");
const eventAction = $<HTMLSelectElement>("#event-action");
const eventSource = $<HTMLInputElement>("#event-source");
const eventSeverity = $<HTMLInputElement>("#event-severity");
const severityVal = $("#severity-val");
const safeZone = $<HTMLInputElement>("#safe-zone");
const sendBtn = $("#send-event");
const idleBtn = $("#idle-tick");
const resetBtn = $("#reset-btn");
const tickDisplay = $("#tick-display");
const actionDisplay = $("#action-display");
const traceDisplay = $("#trace-display");
const timeline = $("#timeline");
const emotionsDisplay = $("#emotions-display");
const moodDisplay = $("#mood-display");
const needsDisplay = $("#needs-display");
const relationshipsDisplay = $("#relationships-display");
const memoriesDisplay = $("#memories-display");
const avatarCanvas = $<HTMLCanvasElement>("#avatar-canvas");
const avatarCtx = avatarCanvas.getContext("2d")!;

// Tab & Scenario elements
const tabManual = $("#tab-manual");
const tabScenario = $("#tab-scenario");
const manualControls = $("#manual-controls");
const scenarioControls = $("#scenario-controls");
const scenarioSelect = $<HTMLSelectElement>("#scenario-select");
const scenarioDesc = $("#scenario-desc");
const scenarioSpeed = $<HTMLInputElement>("#scenario-speed");
const speedVal = $("#speed-val");
const scenarioStartBtn = $("#scenario-start");
const scenarioPauseBtn = $("#scenario-pause");
const scenarioStopBtn = $("#scenario-stop");
const scenarioNarration = $("#scenario-narration");

// --- Label Maps ---

const ACTION_MAP: Record<string, { value: string; label: string }[]> = {
  social: [
    { value: "insulted_by", label: "모욕당함" },
    { value: "betrayed_by", label: "배신당함" },
    { value: "praised_by", label: "칭찬받음" },
    { value: "abandoned_by", label: "버림받음" },
  ],
  combat: [
    { value: "attacked_by", label: "공격받음" },
    { value: "ambushed_by", label: "기습당함" },
    { value: "challenged_by", label: "도전받음" },
  ],
  cognitive: [
    { value: "discovered_artifact", label: "유물 발견" },
    { value: "encountered_puzzle", label: "퍼즐 조우" },
    { value: "received_information", label: "정보 수신" },
  ],
  moral: [
    { value: "witnessed_injustice", label: "불의 목격" },
    { value: "asked_to_lie", label: "거짓말 요구" },
    { value: "offered_bribe", label: "뇌물 제안" },
  ],
};

const EMOTION_LABELS: Record<string, string> = {
  joy: "기쁨",
  distress: "고통",
  hope: "희망",
  fear: "두려움",
  pride: "자부심",
  shame: "수치심",
  admiration: "감탄",
  reproach: "비난",
  gratitude: "감사",
  anger: "분노",
  love: "사랑",
  hate: "증오",
  satisfaction: "만족",
  disappointment: "실망",
  relief: "안도",
  guilt: "죄책감",
  frustration: "좌절",
  affection: "애정",
  envy: "질투",
  loneliness: "외로움",
  contempt: "경멸",
  determination: "결의",
  anxiety: "불안",
};

const EMOTION_EMOJI: Record<string, string> = {
  joy: "\u{1F60A}",
  distress: "\u{1F625}",
  hope: "\u{1F31F}",
  fear: "\u{1F628}",
  pride: "\u{1F60E}",
  shame: "\u{1F633}",
  admiration: "\u{1F929}",
  reproach: "\u{1F620}",
  gratitude: "\u{1F64F}",
  anger: "\u{1F621}",
  love: "\u{2764}\u{FE0F}",
  hate: "\u{1F4A2}",
  satisfaction: "\u{1F60C}",
  disappointment: "\u{1F61E}",
  relief: "\u{1F62E}\u{200D}\u{1F4A8}",
  guilt: "\u{1F614}",
  frustration: "\u{1F624}",
  affection: "\u{1F970}",
  envy: "\u{1F440}",
  loneliness: "\u{1F622}",
  contempt: "\u{1F612}",
  determination: "\u{1F4AA}",
  anxiety: "\u{1F630}",
};

const NEED_LABELS: Record<string, string> = {
  hunger: "배고픔",
  fatigue: "피로",
  pain: "고통",
  safety: "안전",
  affiliation: "소속",
  intimacy: "친밀",
  autonomy: "자율",
  competence: "능력",
  recognition: "인정",
  curiosity: "호기심",
  control: "통제",
  rest: "휴식",
};

interface PersonaVisual {
  skin: string;
  hair: string;
  outfit: string;
  outfitAccent: string;
  hairStyle: "spiky" | "long" | "hood";
  accessory?: "sword" | "book" | "dagger";
}

const PERSONA_VISUALS: Record<string, PersonaVisual> = {
  warrior: {
    skin: "#f5cba7",
    hair: "#8b4513",
    outfit: "#c0392b",
    outfitAccent: "#922b21",
    hairStyle: "spiky",
    accessory: "sword",
  },
  scholar: {
    skin: "#fdebd0",
    hair: "#5b2c6f",
    outfit: "#2471a3",
    outfitAccent: "#1a5276",
    hairStyle: "long",
    accessory: "book",
  },
  rogue: {
    skin: "#e8daef",
    hair: "#1c1c1c",
    outfit: "#2c3e50",
    outfitAccent: "#1a252f",
    hairStyle: "hood",
    accessory: "dagger",
  },
};

// --- Avatar Canvas Drawing ---

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawAvatar() {
  const w = avatarCanvas.width;
  const h = avatarCanvas.height;
  const ctx = avatarCtx;
  ctx.clearRect(0, 0, w, h);

  const v = PERSONA_VISUALS[currentPersonaKey] || PERSONA_VISUALS.warrior;
  const cx = w / 2;
  const mood = state.emotions.mood;
  const topEmotion =
    state.emotions.active.length > 0
      ? state.emotions.active.reduce((a, b) =>
          a.intensity > b.intensity ? a : b,
        )
      : null;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(cx, 180, 28, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outfit / Body (rounded rect torso)
  ctx.fillStyle = v.outfit;
  drawRoundedRect(ctx, cx - 22, 105, 44, 55, 8);
  ctx.fill();
  // Outfit collar
  ctx.fillStyle = v.outfitAccent;
  drawRoundedRect(ctx, cx - 18, 105, 36, 10, 4);
  ctx.fill();

  // Arms
  ctx.lineCap = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = v.outfit;
  const armAngle = mood.arousal > 0.6 ? -0.8 : mood.arousal > 0.4 ? -0.3 : 0.4;
  // Left arm
  ctx.beginPath();
  ctx.moveTo(cx - 22, 118);
  ctx.lineTo(cx - 38, 118 + Math.sin(armAngle) * 30 + 25);
  ctx.stroke();
  // Left hand
  ctx.fillStyle = v.skin;
  ctx.beginPath();
  ctx.arc(cx - 38, 118 + Math.sin(armAngle) * 30 + 25, 5, 0, Math.PI * 2);
  ctx.fill();
  // Right arm
  ctx.strokeStyle = v.outfit;
  ctx.beginPath();
  ctx.moveTo(cx + 22, 118);
  ctx.lineTo(cx + 38, 118 + Math.sin(armAngle) * 30 + 25);
  ctx.stroke();
  // Right hand
  ctx.fillStyle = v.skin;
  ctx.beginPath();
  ctx.arc(cx + 38, 118 + Math.sin(armAngle) * 30 + 25, 5, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = v.outfitAccent;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx - 10, 158);
  ctx.lineTo(cx - 12, 178);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 10, 158);
  ctx.lineTo(cx + 12, 178);
  ctx.stroke();

  // Head (big chibi head)
  const headR = 32;
  const headY = 68;
  // Hair behind head
  ctx.fillStyle = v.hair;
  if (v.hairStyle === "long") {
    ctx.beginPath();
    ctx.ellipse(cx, headY + 2, headR + 6, headR + 12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (v.hairStyle === "hood") {
    ctx.beginPath();
    ctx.ellipse(cx, headY - 2, headR + 5, headR + 5, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    // Hood sides
    ctx.fillStyle = v.outfitAccent;
    ctx.beginPath();
    ctx.moveTo(cx - headR - 3, headY);
    ctx.quadraticCurveTo(cx - headR - 8, headY + 30, cx - 20, headY + 38);
    ctx.lineTo(cx - headR + 2, headY);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + headR + 3, headY);
    ctx.quadraticCurveTo(cx + headR + 8, headY + 30, cx + 20, headY + 38);
    ctx.lineTo(cx + headR - 2, headY);
    ctx.fill();
  }

  // Face
  ctx.fillStyle = v.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Hair on top
  ctx.fillStyle = v.hair;
  if (v.hairStyle === "spiky") {
    // Spiky warrior hair
    const spikes = [
      [cx - 20, headY - 28],
      [cx - 10, headY - 38],
      [cx, headY - 34],
      [cx + 10, headY - 40],
      [cx + 20, headY - 30],
    ];
    ctx.beginPath();
    ctx.moveTo(cx - headR + 2, headY - 8);
    for (const [sx, sy] of spikes) {
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(cx + headR - 2, headY - 8);
    ctx.arc(cx, headY, headR - 2, -0.2, Math.PI + 0.2, true);
    ctx.closePath();
    ctx.fill();
  } else if (v.hairStyle === "long") {
    // Elegant long bangs
    ctx.beginPath();
    ctx.arc(cx, headY - 4, headR + 1, Math.PI + 0.3, -0.3);
    ctx.quadraticCurveTo(cx + 10, headY - 10, cx + 5, headY + 5);
    ctx.lineTo(cx - 5, headY + 5);
    ctx.quadraticCurveTo(cx - 10, headY - 10, cx - headR + 5, headY);
    ctx.closePath();
    ctx.fill();
  } else if (v.hairStyle === "hood") {
    ctx.beginPath();
    ctx.arc(cx, headY - 2, headR + 3, Math.PI + 0.4, -0.4);
    ctx.closePath();
    ctx.fill();
  }

  // Eyes
  const eyeY = headY + 2;
  const eyeSpacing = 11;

  if (mood.valence < -0.3) {
    // Angry/upset eyes - sharp
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing, eyeY, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing, eyeY, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY + 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing, eyeY + 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Highlights
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing + 1.5, eyeY - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing + 1.5, eyeY - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Angry brows
    ctx.strokeStyle = v.hair;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - eyeSpacing - 7, eyeY - 10);
    ctx.lineTo(cx - eyeSpacing + 4, eyeY - 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + eyeSpacing + 7, eyeY - 10);
    ctx.lineTo(cx + eyeSpacing - 4, eyeY - 7);
    ctx.stroke();
  } else if (mood.valence > 0.3) {
    // Happy eyes - closed happy arcs
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY + 2, 6, Math.PI + 0.3, -0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing, eyeY + 2, 6, Math.PI + 0.3, -0.3);
    ctx.stroke();
  } else {
    // Neutral big eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing, eyeY, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing, eyeY, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing, eyeY + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    // Highlights
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing + 2, eyeY - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing + 2, eyeY - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blush (when affection/joy)
  if (
    topEmotion &&
    ["joy", "affection", "love", "gratitude", "pride"].includes(topEmotion.type)
  ) {
    ctx.fillStyle = "rgba(255,150,150,0.3)";
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing - 3, eyeY + 8, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing + 3, eyeY + 8, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth
  const mouthY = headY + 16;
  ctx.lineCap = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#a0522d";
  ctx.beginPath();
  if (mood.valence > 0.3) {
    // Big smile
    ctx.arc(cx, mouthY - 3, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  } else if (mood.valence > 0) {
    // Small smile
    ctx.arc(cx, mouthY - 2, 5, 0.2 * Math.PI, 0.8 * Math.PI);
  } else if (mood.valence > -0.3) {
    // Neutral line
    ctx.moveTo(cx - 5, mouthY);
    ctx.lineTo(cx + 5, mouthY);
  } else {
    // Frown
    ctx.arc(cx, mouthY + 6, 6, 1.2 * Math.PI, 1.8 * Math.PI);
  }
  ctx.stroke();

  // Accessory
  if (v.accessory === "sword") {
    ctx.strokeStyle = "#bdc3c7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 42, 100);
    ctx.lineTo(cx + 42, 155);
    ctx.stroke();
    // Hilt
    ctx.strokeStyle = "#8b4513";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 35, 145);
    ctx.lineTo(cx + 49, 145);
    ctx.stroke();
  } else if (v.accessory === "book") {
    ctx.fillStyle = "#8e44ad";
    drawRoundedRect(ctx, cx + 32, 130, 16, 20, 2);
    ctx.fill();
    ctx.fillStyle = "#f5f5dc";
    ctx.fillRect(cx + 34, 133, 12, 14);
  } else if (v.accessory === "dagger") {
    ctx.strokeStyle = "#95a5a6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 40, 125);
    ctx.lineTo(cx + 40, 150);
    ctx.stroke();
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 36, 147);
    ctx.lineTo(cx + 44, 147);
    ctx.stroke();
  }

  // Emotion emoji bubble
  if (topEmotion) {
    const emoji = EMOTION_EMOJI[topEmotion.type] || "";
    if (emoji) {
      const bx = cx + 48;
      const by = 30;
      // Bubble with tail
      ctx.fillStyle = "rgba(20,20,42,0.9)";
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(bx - 8, by + 12);
      ctx.lineTo(bx - 16, by + 22);
      ctx.lineTo(bx - 2, by + 14);
      ctx.closePath();
      ctx.fill();
      // Border
      ctx.strokeStyle = topEmotion.intensity > 0.5 ? "#ff6b6b" : "#4ecdc4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        bx,
        by,
        16,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * topEmotion.intensity,
      );
      ctx.stroke();
      // Emoji
      ctx.font = "18px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, bx, by + 1);
    }
  }

  // Name label
  ctx.fillStyle = "#999";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(SEEDS[currentPersonaKey].name, cx, 190);
}

// --- Render Functions ---

function renderPersonaInfo() {
  const seed = SEEDS[currentPersonaKey];
  const labels = ["개방성", "성실성", "외향성", "우호성", "신경성"];
  const big5 = seed.bigFive
    .map(
      (v, i) =>
        `<span class="label">${labels[i]}:</span> <span class="value">${v}</span>`,
    )
    .join("<br>");
  personaInfo.innerHTML = `
    <div><span class="label">이름:</span> <span class="value">${seed.name}</span></div>
    <div><span class="label">ID:</span> <span class="value">${seed.id}</span></div>
    <div><span class="label">자아상:</span> <span class="value">${seed.selfConcept}</span></div>
    <div><span class="label">가치관:</span> <span class="value">${seed.coreValues.join(", ")}</span></div>
    <div><span class="label">역할:</span> <span class="value">${seed.roles.join(", ")}</span></div>
    <div style="margin-top:4px">${big5}</div>
  `;
}

function renderActionOptions() {
  const cat = eventCategory.value;
  const actions = ACTION_MAP[cat] || ACTION_MAP.social;
  eventAction.innerHTML = actions
    .map((a) => `<option value="${a.value}">${a.label}</option>`)
    .join("");
}

function renderAction(response: BehaviorResponse) {
  const a = response.action;
  const intensityPct = Math.round(a.intensity * 100);
  const params = Object.entries(a.params)
    .map(([k, v]) => `<span>${k}: ${v}</span>`)
    .join("");

  actionDisplay.innerHTML = `
    <div class="action-type">${a.type.replace(/_/g, " ").toUpperCase()}</div>
    <div class="action-target">\u2192 ${a.target || "자신"}</div>
    <div class="action-intensity">
      <div class="action-intensity-fill" style="width: ${intensityPct}%"></div>
    </div>
    <div class="action-params">${params || "<span>없음</span>"}</div>
  `;
}

function renderTrace(response: BehaviorResponse) {
  const t = response.trace;
  const conflicts = t.conflictsResolved
    .map(
      (c) =>
        `<div class="conflict">
      <span style="color:#ff6b6b">${c.a}</span> vs <span style="color:#4ecdc4">${c.b}</span>
      \u2192 <span style="color:#ff9f43">${c.winner}</span>
      <div style="color:#666;font-size:10px">${c.reason}</div>
    </div>`,
    )
    .join("");

  const alts = t.alternativesConsidered
    .map(
      (a) =>
        `<div class="alternative">
      ${a.action} (score: ${a.score}) \u2014 ${a.rejected}
    </div>`,
    )
    .join("");

  traceDisplay.innerHTML = `
    <div class="trace-line"><span class="trace-label">평가</span><span class="trace-value highlight">${t.appraisal}</span></div>
    <div class="trace-line"><span class="trace-label">주요 동기</span><span class="trace-value">${t.dominantMotive}</span></div>
    ${t.matchedPattern ? `<div class="trace-line"><span class="trace-label">패턴</span><span class="trace-value highlight">${t.matchedPattern}</span></div>` : ""}
    ${conflicts ? `<div style="margin-top:6px"><span class="trace-label">갈등 해결</span>${conflicts}</div>` : ""}
    ${alts ? `<div style="margin-top:6px"><span class="trace-label">대안</span>${alts}</div>` : ""}
  `;
}

function renderTimeline() {
  timeline.innerHTML = history
    .slice()
    .reverse()
    .map((h, i) => {
      const isActive = i === 0 ? "active" : "";
      const narr = h.narration
        ? `<span style="color:#7c8aff;margin-left:6px">${h.narration}</span>`
        : "";
      return `<div class="timeline-entry ${isActive}" data-idx="${history.length - 1 - i}">
      <span class="t-tick">T${h.tick}</span>
      <span class="t-action">${h.response.action.type.replace(/_/g, " ")}</span>
      <span class="t-target">\u2192 ${h.response.action.target || "자신"}</span>
      ${narr}
    </div>`;
    })
    .join("");

  timeline.querySelectorAll(".timeline-entry").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt((el as HTMLElement).dataset.idx!);
      const h = history[idx];
      if (h) {
        renderAction(h.response);
        renderTrace(h.response);
      }
    });
  });
}

function renderEmotions() {
  const emotions = state.emotions.active;
  if (emotions.length === 0) {
    emotionsDisplay.innerHTML =
      '<div style="color:#444;font-size:11px">활성 감정 없음</div>';
    return;
  }
  emotionsDisplay.innerHTML = emotions
    .sort((a, b) => b.intensity - a.intensity)
    .map((e) => {
      const pct = Math.round(e.intensity * 100);
      const emoji = EMOTION_EMOJI[e.type] || "";
      return `<div class="emotion-bar">
        <span class="bar-label">${emoji} ${EMOTION_LABELS[e.type] || e.type}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span class="bar-value">${e.intensity.toFixed(2)}</span>
      </div>`;
    })
    .join("");
}

function renderMood() {
  const m = state.emotions.mood;
  moodDisplay.innerHTML = `<div class="mood-indicator">
    <div class="mood-item">
      <span class="mood-label">감정가</span>
      <span class="mood-value" style="color:${m.valence >= 0 ? "#4ecdc4" : "#ff6b6b"}">${m.valence.toFixed(2)}</span>
    </div>
    <div class="mood-item">
      <span class="mood-label">각성도</span>
      <span class="mood-value">${m.arousal.toFixed(2)}</span>
    </div>
  </div>`;
}

function renderNeeds() {
  const needs = state.needs.needs;
  needsDisplay.innerHTML = needs
    .map((n) => {
      const pct = Math.round(n.current * 100);
      return `<div class="need-bar">
      <span class="bar-label">${NEED_LABELS[n.id] || n.id}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <span class="bar-value">${n.current.toFixed(2)}</span>
    </div>`;
    })
    .join("");
}

function renderRelationships() {
  const rels = state.social.relationships;
  if (rels.length === 0) {
    relationshipsDisplay.innerHTML =
      '<div style="color:#444;font-size:11px">관계 없음</div>';
    return;
  }
  relationshipsDisplay.innerHTML = rels
    .map((r) => {
      const stats = [
        `<span class="rel-stat ${r.trust >= 0 ? "positive" : "negative"}">신뢰: ${r.trust.toFixed(2)}</span>`,
        `<span class="rel-stat ${r.affection >= 0 ? "positive" : "negative"}">호감: ${r.affection.toFixed(2)}</span>`,
        `<span class="rel-stat">존경: ${r.respect.toFixed(2)}</span>`,
        `<span class="rel-stat">친밀도: ${r.familiarity.toFixed(2)}</span>`,
      ].join("");
      return `<div class="rel-card">
      <div class="rel-name">${r.targetId} <span style="color:#666;font-weight:400">[${r.tags.join(", ")}]</span></div>
      <div class="rel-stats">${stats}</div>
    </div>`;
    })
    .join("");
}

function renderMemories() {
  const mems = state.memory.memories;
  if (mems.length === 0) {
    memoriesDisplay.innerHTML =
      '<div style="color:#444;font-size:11px">기억 없음</div>';
    return;
  }
  memoriesDisplay.innerHTML = mems
    .slice(-10)
    .reverse()
    .map((m) => {
      if (m.type === "episodic") {
        const cls =
          m.emotionalValence > 0
            ? "positive"
            : m.emotionalValence < 0
              ? "negative"
              : "";
        return `<div class="memory-item ${cls}">
        <div>${m.description}</div>
        <div style="color:#555;margin-top:2px">T${m.tick} \u00B7 valence: ${m.emotionalValence.toFixed(1)} \u00B7 importance: ${m.importance.toFixed(1)}</div>
      </div>`;
      }
      return `<div class="memory-item">
        <div>${m.fact}</div>
        <div style="color:#555;margin-top:2px">T${m.tick} \u00B7 confidence: ${m.confidence.toFixed(1)}</div>
      </div>`;
    })
    .join("");
}

function renderState() {
  renderEmotions();
  renderMood();
  renderNeeds();
  renderRelationships();
  renderMemories();
}

function updateTick() {
  tickDisplay.textContent = `틱: ${tick}`;
}

function renderAll(response: BehaviorResponse) {
  updateTick();
  renderAction(response);
  renderTrace(response);
  renderTimeline();
  renderState();
  drawAvatar();
}

function resetUI() {
  state = hydratePersona(SEEDS[currentPersonaKey]);
  tick = 0;
  history = [];
  updateTick();
  renderPersonaInfo();
  renderState();
  drawAvatar();
  actionDisplay.innerHTML =
    '<div class="placeholder">이벤트를 전송하면 응답이 표시됩니다</div>';
  traceDisplay.innerHTML = '<div class="placeholder">-</div>';
  timeline.innerHTML = "";
  scenarioNarration.style.display = "none";
}

// --- Process helpers ---

function processEvent(
  category: EventCategory,
  action: string,
  source?: string,
  severity = 0.7,
  safe = false,
  nearby?: string[],
): BehaviorResponse {
  tick++;
  state.tick = tick;
  const request: BehaviorRequest = {
    personaId: state.id,
    tick,
    type: "event",
    event: { category, action, source, context: { severity } },
    worldState: {
      nearbyEntities: nearby || (source ? [source] : []),
      safeZone: safe,
    },
  };
  return processBehavior(state, request, { mutateState: true });
}

function processIdle(): BehaviorResponse {
  tick++;
  state.tick = tick;
  const request: BehaviorRequest = {
    personaId: state.id,
    tick,
    type: "tick_update",
    worldState: { nearbyEntities: [], safeZone: true },
  };
  return processBehavior(state, request, { mutateState: true });
}

// --- Scenario Definitions ---

interface ScenarioStep {
  narration: string;
  event?: {
    category: EventCategory;
    action: string;
    source?: string;
    severity?: number;
    safeZone?: boolean;
    nearby?: string[];
  };
}

interface Scenario {
  id: string;
  label: string;
  description: string;
  steps: ScenarioStep[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "daily_life",
    label: "일상 생활 (하루)",
    description:
      "아침부터 밤까지 NPC의 하루를 시뮬레이션합니다. 배고픔, 피로, 사회적 교류가 발생합니다.",
    steps: [
      { narration: "\u{1F305} 아침 \u2014 잠에서 깨어남. 배가 고프다." },
      { narration: "\u{1F373} 아침 식사를 위해 마을로 향함. 시간이 흐른다." },
      {
        narration:
          "\u{1F44B} 마을 광장에서 동료 ally-001을 만남. 인사를 나눈다.",
        event: {
          category: "social",
          action: "praised_by",
          source: "ally-001",
          severity: 0.3,
          safeZone: true,
        },
      },
      { narration: "\u{2615} 잠시 쉬며 주변을 살핀다. 평화로운 아침이다." },
      {
        narration:
          "\u{1F5E3}\uFE0F 낯선 상인 merchant-001과 대화. 최근 도적이 출몰한다는 소문을 듣는다.",
        event: {
          category: "cognitive",
          action: "received_information",
          source: "merchant-001",
          severity: 0.4,
          safeZone: true,
        },
      },
      {
        narration: "\u{1F3CB}\uFE0F 오전 훈련. 체력이 소모된다.",
      },
      {
        narration:
          '\u{1F6E1}\uFE0F 훈련 중 라이벌 rival-001이 도발한다. "넌 약해졌어."',
        event: {
          category: "social",
          action: "insulted_by",
          source: "rival-001",
          severity: 0.5,
          safeZone: true,
          nearby: ["rival-001", "ally-001"],
        },
      },
      { narration: "\u{1F32E} 점심 시간. 식사를 하며 기운을 회복한다." },
      {
        narration: "\u{1F6B6} 오후 순찰. 마을 외곽에서 수상한 흔적을 발견한다.",
        event: {
          category: "cognitive",
          action: "discovered_artifact",
          source: "world",
          severity: 0.5,
        },
      },
      {
        narration: "\u{2694}\uFE0F 순찰 중 도적 bandit-001의 기습을 받는다!",
        event: {
          category: "combat",
          action: "attacked_by",
          source: "bandit-001",
          severity: 0.7,
          safeZone: false,
          nearby: ["bandit-001"],
        },
      },
      {
        narration:
          "\u{1F3E0} 전투 후 마을로 귀환. ally-001이 걱정하며 맞이한다.",
        event: {
          category: "social",
          action: "praised_by",
          source: "ally-001",
          severity: 0.5,
          safeZone: true,
        },
      },
      { narration: "\u{1F319} 저녁. 피로가 쌓여 휴식을 취한다." },
      {
        narration:
          "\u{1F4AD} 잠들기 전, 오늘 하루를 되돌아본다. 도적 문제가 신경 쓰인다.",
      },
    ],
  },
  {
    id: "betrayal_arc",
    label: "배신 시나리오",
    description:
      "가장 신뢰하던 동료에게 배신당하는 과정. 감정 변화와 관계 파괴를 관찰합니다.",
    steps: [
      {
        narration:
          "\u{1F91D} 오랜 동료 ally-001과 함께 임무를 준비한다. 신뢰가 두텁다.",
        event: {
          category: "social",
          action: "praised_by",
          source: "ally-001",
          severity: 0.4,
          safeZone: true,
        },
      },
      { narration: "\u{1F5FA}\uFE0F 위험한 지역으로 함께 출발한다." },
      {
        narration:
          "\u{2694}\uFE0F 도중 적과 조우. ally-001과 함께 맞서 싸운다.",
        event: {
          category: "combat",
          action: "attacked_by",
          source: "enemy-001",
          severity: 0.6,
          safeZone: false,
          nearby: ["ally-001", "enemy-001"],
        },
      },
      {
        narration: "\u{1F4B0} 전리품을 발견한다. ally-001의 눈빛이 달라진다.",
        event: {
          category: "cognitive",
          action: "discovered_artifact",
          source: "world",
          severity: 0.3,
        },
      },
      {
        narration:
          "\u{1F914} 무언가 이상하다. ally-001이 몰래 연락을 취하는 것 같다.",
      },
      {
        narration:
          '\u{1F5E1}\uFE0F ally-001이 뒤에서 칼을 꺼낸다! "미안하지만, 이건 내 것이다."',
        event: {
          category: "social",
          action: "betrayed_by",
          source: "ally-001",
          severity: 0.9,
          safeZone: false,
          nearby: ["ally-001"],
        },
      },
      {
        narration: "\u{1F494} 배신의 충격. 가장 신뢰하던 사람이었는데...",
      },
      {
        narration:
          "\u{1F3C3} ally-001이 전리품을 들고 도주한다. 버림받은 기분이다.",
        event: {
          category: "social",
          action: "abandoned_by",
          source: "ally-001",
          severity: 0.7,
          safeZone: false,
        },
      },
      { narration: "\u{1F62D} 홀로 남겨진 채, 상처를 감싼다." },
      {
        narration:
          "\u{1F6B6} 힘겹게 마을로 돌아온다. merchant-001이 소식을 전한다.",
        event: {
          category: "cognitive",
          action: "received_information",
          source: "merchant-001",
          severity: 0.5,
          safeZone: true,
        },
      },
      {
        narration: '\u{1F4AA} 분노와 결의가 뒤섞인다. "다시는 당하지 않겠다."',
      },
    ],
  },
  {
    id: "adventure",
    label: "모험 시나리오",
    description: "미지의 유적을 탐험하며 발견, 위험, 도덕적 선택을 마주합니다.",
    steps: [
      {
        narration:
          "\u{1F30C} 오래된 지도를 손에 들고 미지의 유적을 향해 출발한다.",
      },
      {
        narration:
          "\u{1F50D} 유적 입구에 도착. 고대 문자가 새겨진 석판을 발견한다.",
        event: {
          category: "cognitive",
          action: "discovered_artifact",
          source: "world",
          severity: 0.6,
        },
      },
      {
        narration: "\u{1F573}\uFE0F 어두운 통로로 진입한다. 긴장감이 고조된다.",
      },
      {
        narration:
          "\u{1F577}\uFE0F 함정이 작동한다! 거대한 거미 spider-001이 나타난다!",
        event: {
          category: "combat",
          action: "ambushed_by",
          source: "spider-001",
          severity: 0.8,
          safeZone: false,
          nearby: ["spider-001"],
        },
      },
      {
        narration: "\u{1F48E} 전투 후 깊은 방에서 빛나는 유물을 발견한다.",
        event: {
          category: "cognitive",
          action: "discovered_artifact",
          source: "world",
          severity: 0.8,
        },
      },
      {
        narration:
          '\u{1F9D4} 유적의 수호자 guardian-001이 나타나 도전한다. "그 유물의 자격을 증명하라."',
        event: {
          category: "combat",
          action: "challenged_by",
          source: "guardian-001",
          severity: 0.6,
          safeZone: false,
          nearby: ["guardian-001"],
        },
      },
      { narration: "\u{1F3C6} 시련을 통과했다. 수호자가 고개를 끄덕인다." },
      {
        narration:
          "\u{2696}\uFE0F 유적을 나서는데, 마을 사람들이 약탈당하고 있다. 도울 것인가?",
        event: {
          category: "moral",
          action: "witnessed_injustice",
          source: "world",
          severity: 0.7,
          safeZone: false,
          nearby: ["villager-001", "bandit-002"],
        },
      },
      {
        narration: "\u{2694}\uFE0F 약탈자 bandit-002와 교전!",
        event: {
          category: "combat",
          action: "attacked_by",
          source: "bandit-002",
          severity: 0.6,
          safeZone: false,
          nearby: ["bandit-002", "villager-001"],
        },
      },
      {
        narration: "\u{1F64F} 마을 사람들이 감사를 표한다.",
        event: {
          category: "social",
          action: "praised_by",
          source: "villager-001",
          severity: 0.6,
          safeZone: true,
        },
      },
      {
        narration:
          "\u{1F305} 유물을 품에 안고 집으로 향한다. 보람찬 모험이었다.",
      },
    ],
  },
];

// --- Scenario Runner ---

let scenarioTimer: number | null = null;
let scenarioStepIdx = 0;
let currentScenario: Scenario | null = null;
let scenarioPaused = false;

function getSelectedScenario(): Scenario {
  return SCENARIOS.find((s) => s.id === scenarioSelect.value) || SCENARIOS[0];
}

function showNarration(text: string, stepNum: number, totalSteps: number) {
  scenarioNarration.style.display = "block";
  scenarioNarration.innerHTML = `
    <div class="narration-time">단계 ${stepNum}/${totalSteps}</div>
    <div class="narration-text">${text}</div>
    <div class="scenario-progress">
      <div class="progress-fill" style="width:${Math.round((stepNum / totalSteps) * 100)}%"></div>
    </div>
  `;
}

function runScenarioStep() {
  if (!currentScenario || scenarioStepIdx >= currentScenario.steps.length) {
    stopScenario();
    scenarioNarration.innerHTML = `
      <div class="narration-time">완료</div>
      <div class="narration-text">\u2705 시나리오 "${currentScenario?.label}" 종료. 타임라인에서 각 단계를 클릭하여 상세를 확인하세요.</div>
    `;
    return;
  }

  const step = currentScenario.steps[scenarioStepIdx];
  showNarration(
    step.narration,
    scenarioStepIdx + 1,
    currentScenario.steps.length,
  );

  let response: BehaviorResponse;
  if (step.event) {
    response = processEvent(
      step.event.category,
      step.event.action,
      step.event.source,
      step.event.severity,
      step.event.safeZone,
      step.event.nearby,
    );
  } else {
    response = processIdle();
  }

  history.push({ tick, response, narration: step.narration.slice(0, 30) });
  renderAll(response);
  scenarioStepIdx++;
}

function startScenario() {
  currentScenario = getSelectedScenario();
  resetUI();
  scenarioStepIdx = 0;
  scenarioPaused = false;

  scenarioStartBtn.style.display = "none";
  scenarioPauseBtn.style.display = "block";
  scenarioPauseBtn.textContent = "일시정지";
  scenarioStopBtn.style.display = "block";

  const speed = parseInt(scenarioSpeed.value);
  scenarioTimer = window.setInterval(() => {
    if (!scenarioPaused) {
      runScenarioStep();
    }
  }, speed);
}

function pauseScenario() {
  scenarioPaused = !scenarioPaused;
  scenarioPauseBtn.textContent = scenarioPaused ? "재개" : "일시정지";
}

function stopScenario() {
  if (scenarioTimer !== null) {
    clearInterval(scenarioTimer);
    scenarioTimer = null;
  }
  scenarioStartBtn.style.display = "block";
  scenarioPauseBtn.style.display = "none";
  scenarioStopBtn.style.display = "none";
}

// --- World Mode ---

import { initWorldMode, destroyWorldMode } from "./world/world-mode";

const tabWorld = $("#tab-world");
const mainLayout = document.querySelector<HTMLDivElement>(".layout")!;
const worldView = $("#world-view");
let worldInitialized = false;

function showMainLayout() {
  mainLayout.style.display = "grid";
  worldView.style.display = "none";
  destroyWorldMode();
}

function showWorldLayout() {
  mainLayout.style.display = "none";
  worldView.style.display = "grid";
  stopScenario();
  if (!worldInitialized) {
    initWorldMode();
    worldInitialized = true;
  }
}

// --- Tab Switching ---

tabManual.addEventListener("click", () => {
  tabManual.classList.add("active");
  tabScenario.classList.remove("active");
  tabWorld.classList.remove("active");
  manualControls.style.display = "block";
  scenarioControls.style.display = "none";
  showMainLayout();
  stopScenario();
});

tabScenario.addEventListener("click", () => {
  tabScenario.classList.add("active");
  tabManual.classList.remove("active");
  tabWorld.classList.remove("active");
  manualControls.style.display = "none";
  scenarioControls.style.display = "block";
  showMainLayout();
  updateScenarioDesc();
});

tabWorld.addEventListener("click", () => {
  tabWorld.classList.add("active");
  tabManual.classList.remove("active");
  tabScenario.classList.remove("active");
  showWorldLayout();
});

// --- Event Handlers ---

personaBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    personaBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentPersonaKey = btn.dataset.persona!;
    stopScenario();
    resetUI();
  });
});

eventCategory.addEventListener("change", renderActionOptions);

eventSeverity.addEventListener("input", () => {
  severityVal.textContent = eventSeverity.value;
});

sendBtn.addEventListener("click", () => {
  const response = processEvent(
    eventCategory.value as EventCategory,
    eventAction.value,
    eventSource.value || undefined,
    parseFloat(eventSeverity.value),
    safeZone.checked,
  );
  history.push({ tick, response });
  renderAll(response);
});

idleBtn.addEventListener("click", () => {
  const response = processIdle();
  history.push({ tick, response });
  renderAll(response);
});

resetBtn.addEventListener("click", resetUI);

// Scenario controls
function updateScenarioDesc() {
  const sc = getSelectedScenario();
  scenarioDesc.innerHTML = `
    <div>${sc.description}</div>
    <div style="margin-top:4px;color:#7c8aff">${sc.steps.length}단계</div>
  `;
}

scenarioSelect.addEventListener("change", updateScenarioDesc);

scenarioSpeed.addEventListener("input", () => {
  speedVal.textContent = `${(parseInt(scenarioSpeed.value) / 1000).toFixed(1)}초`;
});

scenarioStartBtn.addEventListener("click", startScenario);
scenarioPauseBtn.addEventListener("click", pauseScenario);
scenarioStopBtn.addEventListener("click", () => {
  stopScenario();
  scenarioNarration.innerHTML = `
    <div class="narration-time">중단됨</div>
    <div class="narration-text">시나리오가 중단되었습니다. 타임라인에서 진행된 단계를 확인할 수 있습니다.</div>
  `;
});

// --- Initial Render ---

renderPersonaInfo();
renderActionOptions();
renderState();
updateTick();
drawAvatar();
updateScenarioDesc();
