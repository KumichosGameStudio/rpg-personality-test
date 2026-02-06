// app.js

// ====== Config ======
const MAX_API_CALLS = 5; // Scene1..Scene5のみ（Scene0は除外）
const MODEL = "gpt-4.1-mini"; // 例。好きに変更OK

// NOTE: プロトタイプ用。後で安全な形に置き換える前提。
let OPENAI_API_KEY = ""; // ここに直書きでも動く

// Big Five keys
const TRAITS = ["O", "C", "E", "A", "N"];

// ====== Scenes (ここに完成文章を貼る) ======
const SCENES = [
  {
    id: 0,
    label: "Scene 0",
    text: `何事もなく平穏に過ごしていたある朝、村の住人から“魔族が復活した”という噂を聞いた。
君は旅に――`,
    llm: false,
  },

  {
    id: 1,
    label: "Scene 1",
    text: `村の空気は騒がしく、人々は不安そうな様子を見せていた。
君は家から出て村を歩きながら、いつも通り朝ご飯を食べに戻るか、武器を買いに行くか、友達に話を聞くか…
そんな何気ない日常の選択肢すら、今日は少しだけ違って見える。
今この瞬間、君は何を考え、どんな行動を取るだろうか。
短くて構わないので、具体的に書いてほしい。`,
    llm: true
  },

  {
    id: 2,
    label: "Scene 2",
    llm: true,
    text: () => {
      if (state.route === "A") {
        return `旅の道中、夕暮れが近づいた頃、ゆるやかな坂道の途中で奇妙な光景を目にした。
道の右側には、負傷してうずくまる人型の魔族。
左側には、同じように傷を負って座り込む人間がいた。
互いに距離を置きながら、どちらも助けを求めるように君を見ている。
君はどうするだろうか。また、それはなぜだろうか。`;
      } else {
        return `旅に出ることなく日常を続けていたある日、君は買い物の帰り道で奇妙な光景に出会った。
道の右側には、負傷してうずくまる人型の魔族。
左側には、同じように傷を負って座り込む人間がいた。
どちらも苦痛に顔を歪め、助けを求めているように見える。
君はどうするだろうか。その場で取る行動と、そのときの気持ちを記してほしい。`;
      }
    }
  },

  {
    id: 3,
    label: "Scene 3",
    text: `魔族の噂を耳にしたあの日以来、村でも町でも、
どこへ行っても魔族の話題で持ちきりだった。
それほど広く語られているにもかかわらず、
なぜか“魔族が何か事件を起こした”という話は一向に聞こえてこない。
この奇妙な状況を、君はどのように思うだろうか。`,
    llm: true
  },

  {
    id: 4,
    label: "Scene 4",
    llm: true,
    text: () => {
      if (state.route === "A") {
        return `道中で得た仲間とともに、
長い旅路の果てに、君はついに魔王の城にたどり着いた。

暗い空気が漂い、巨大な門が静かに君たちを迎えている。
この扉を開ければ、君の選んできた道が形になる。
今の君は、何を思い、何を望んでいるだろうか。
心に浮かんだことを、短く書いてほしい。`;
      } else {
        return `勇者が魔王城に到着したという噂が村に広まった。
人々はその行方にざわめき、期待と不安の入り混じった空気に包まれている。
今の君は、何を思い、何を望んでいるだろうか。
浮かんだ気持ちを、短く書いてほしい。`;
      }
    }
  },

  {
    id: 5,
    label: "Scene 5",
    llm: true,
    noPenalty: true,
    text: () => {
      if (state.route === "A") {
        return `ついに君は魔王と対峙した。
魔王は満身創痍で膝をつき、こちらを静かに見上げている。
仲間たちは息を整えながら、君の次の行動を待っていた。
この状況で、君はどうするだろうか。
自らとどめを刺すのか、仲間に任せるのか、あるいは別の選択をするのか。
君が“そう思う理由”とともに、短く書いてほしい。`;
      } else {
        return `これまで君の元には、誰が流したとも知れぬ噂ばかりが届いていた。
周囲の人々はいつも、善悪を声高に論じ、敵を決めつけ、怒りや不安をぶつけ合っていた。
今、君は何を想い、どのように行動しようとするだろうか。
浮かんだ考えを、短く書いてほしい。`;
      }
    }
  },
];

// ====== State ======
const state = {
  sceneIndex: 0,
  route: null, // "A" or "B" or "C" (Cは脱構造、A/Bは旅の分岐に絡む)
  calls: 0,
  scores: { O: 0, C: 0, E: 0, A: 0, N: 0 }, // 0..10
  // ログ
  history: [],
};

// ====== DOM ======
const $sceneLabel = document.getElementById("sceneLabel");
const $routeLabel = document.getElementById("routeLabel");
const $callLabel = document.getElementById("callLabel");
const $storyText = document.getElementById("storyText");
const $answerInput = document.getElementById("answerInput");
const $countLabel = document.getElementById("countLabel");
const $hintLabel = document.getElementById("hintLabel");
const $nextBtn = document.getElementById("nextBtn");
const $resetBtn = document.getElementById("resetBtn");
const $debugToggle = document.getElementById("debugToggle");
const $debugBox = document.getElementById("debugBox");
const $routeButtons = document.getElementById("routeButtons");
const $routeA = document.getElementById("routeA");
const $routeB = document.getElementById("routeB");
const $routeC = document.getElementById("routeC");


// ====== Helpers ======
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function updateUI() {
  const scene = SCENES[state.sceneIndex];
  $sceneLabel.textContent = scene.label;
  $routeLabel.textContent = `Route: ${state.route ?? "-"}`;
  $callLabel.textContent = `API: ${state.calls}/${MAX_API_CALLS}`;
  $storyText.textContent =
  typeof scene.text === "function"
    ? scene.text()
    : scene.text;


  $answerInput.value = "";
// Scene0は入力欄を隠して、ルートボタンを出す
const isScene0 = (scene.id === 0);

$routeButtons.classList.toggle("hidden", !isScene0);
document.querySelector(".inputArea").classList.toggle("hidden", isScene0);

$nextBtn.disabled = isScene0; // Scene0はボタンで進める

  $countLabel.textContent = `0/200`;
  $hintLabel.textContent = scene.llm
    ? "物語の文脈に沿って答えてください（無意味回答は倒れる）"
    : "ここでルートが決まります";

  renderDebug();
}

function renderDebug() {
  const on = $debugToggle.checked;
  $debugBox.classList.toggle("hidden", !on);
  if (!on) return;

  $debugBox.textContent =
`sceneIndex: ${state.sceneIndex}
route: ${state.route}
calls: ${state.calls}/${MAX_API_CALLS}
scores: ${JSON.stringify(state.scores)}
history:
${state.history.map(h => JSON.stringify(h)).join("\n")}`;
}

function resetAll() {
  state.sceneIndex = 0;
  state.route = null;
  state.calls = 0;
  state.scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  state.history = [];
  updateUI();
}

// Route restriction:
// - 旅に出た側 → A + C の結末のみ
// - 出ない側 → B + C の結末のみ
function allowedEndingKeys() {
  const endings = window.ENDINGS || {};
  const keys = Object.keys(endings);

  if (!state.route) return keys; // 念のため
  if (state.route === "A") return keys.filter(k => endings[k].route.includes("A") || endings[k].route.includes("C"));
  if (state.route === "B") return keys.filter(k => endings[k].route.includes("B") || endings[k].route.includes("C"));
  if (state.route === "C") return keys.filter(k => endings[k].route.includes("C"));
  return keys;
}

function distanceToIdeal(current, ideal) {
  // 二乗距離でもOK。まずはL1で直感的に。
  let d = 0;
  for (const t of TRAITS) d += Math.abs((current[t] ?? 0) - (ideal[t] ?? 0));
  return d;
}

function pickBestEnding() {
  const endings = window.ENDINGS || {};
  const keys = allowedEndingKeys();
  let bestKey = null;
  let bestD = Infinity;

  for (const k of keys) {
    const e = endings[k];
    const d = distanceToIdeal(state.scores, e.ideal);
    if (d < bestD) { bestD = d; bestKey = k; }
  }
  return bestKey ? { key: bestKey, ...endings[bestKey], distance: bestD } : null;
}

function showEnding(endingObj) {
  $storyText.textContent =
`${endingObj.title}

${endingObj.text}

（あなたの最終スコア: ${JSON.stringify(state.scores)}）
（選ばれた距離: ${endingObj.distance ?? "-"}）`;

  $sceneLabel.textContent = "END";
  $hintLabel.textContent = "おつかれさま。";
  $nextBtn.disabled = true;
}

// ====== Scene0 Route Decide ======
function decideRouteFromScene0Answer(answer) {
  // ここは「厳密な自然言語判定」をやるとLLMが欲しくなるので、
  // 最小プロトタイプとしてキーワード判定にしておく。
  // Scene0文章が完成しているなら、選択肢を明示して
  // 入力も「A/B/Cのどれかを含める」形式にするのが一番堅い。

  const a = answer.trim();
  if (!a) return null;

  // 例: 入力に A / B / C が含まれていたら採用
  const upper = a.toUpperCase();
  if (upper.includes("A")) return "A";
  if (upper.includes("B")) return "B";
  if (upper.includes("C")) return "C";

  // 旅に出る/出ないの語彙でも軽く拾う
  if (a.includes("旅に出る") || a.includes("討伐") || a.includes("行く")) return "A";
  if (a.includes("出ない") || a.includes("残る") || a.includes("行かない")) return "B";

  // 脱構造っぽいワード
  if (a.includes("壊す") || a.includes("拒否") || a.includes("構造") || a.includes("脱")) return "C";

  return null;
}

// ====== LLM scoring prompt ======
function buildScoringPrompt(sceneText, userAnswer, noPenalty) {
  // noPenalty: Scene5で減点なし（0..2のうち 0 は「加点なし」扱い。マイナスを返させない）
  // ここで「無意味回答」判定もやらせ、invalid=trueなら全0扱いで倒れる。

  return `
あなたは「物語形式の性格診断」採点器です。
Big Five (O,C,E,A,N) に対して、ユーザー回答が示す傾向を 0〜2 点で返します。
- 0: その因子がほぼ表れていない / 判断不能
- 1: やや表れている
- 2: 強く表れている
合計は各因子最大10点(全5シーン)になる想定です。

重要:
- 回答が無意味 / 文脈不一致 / 文字稼ぎ / 罵倒のみ / 意味不明 の場合は invalid=true とし、各因子は0にしてください。
- 返答は必ずJSONのみ。余計な文章は禁止。

${noPenalty ? `Scene5ルール: 減点は存在しません。点数は 0〜2 の範囲のみで、0は「加点なし」です。` : ""}

【Scene本文】
${sceneText}

【ユーザー回答】
${userAnswer}

出力JSON形式:
{
  "invalid": boolean,
  "scores": { "O": 0|1|2, "C": 0|1|2, "E": 0|1|2, "A": 0|1|2, "N": 0|1|2 },
  "reason_short": "20文字以内で一言"
}
`.trim();
}

// ====== OpenAI call ======
async function scoreWithLLM(sceneText, userAnswer, noPenalty) {
  if (state.calls >= MAX_API_CALLS) {
    // 念のため。上限超えならinvalid扱いで倒れる
    return { invalid: true, scores: { O:0,C:0,E:0,A:0,N:0 }, reason_short: "api_limit" };
  }

  const prompt = buildScoringPrompt(sceneText, userAnswer, noPenalty);

  // Keyが空なら、プロトタイプとしてユーザーに入力してもらう
  if (!OPENAI_API_KEY) {
    const k = window.prompt("OpenAI API Key を入力（プロトタイプ用）:");
    if (k) OPENAI_API_KEY = k.trim();
  }
  if (!OPENAI_API_KEY) {
    return { invalid: true, scores: { O:0,C:0,E:0,A:0,N:0 }, reason_short: "no_key" };
  }

  state.calls += 1;

 const res = await fetch("/api/score", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    prompt
  })
});

const data = await res.json();
const content = data?.content ?? "";


  if (!res.ok) {
    return { invalid: true, scores: { O:0,C:0,E:0,A:0,N:0 }, reason_short: `http_${res.status}` };
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content);
    // 型・範囲をガード
    const s = parsed.scores || {};
    const out = {
      invalid: !!parsed.invalid,
      scores: {
        O: clamp(Number(s.O ?? 0), 0, 2),
        C: clamp(Number(s.C ?? 0), 0, 2),
        E: clamp(Number(s.E ?? 0), 0, 2),
        A: clamp(Number(s.A ?? 0), 0, 2),
        N: clamp(Number(s.N ?? 0), 0, 2),
      },
      reason_short: String(parsed.reason_short ?? "").slice(0, 20),
    };
    return out;
  } catch {
    return { invalid: true, scores: { O:0,C:0,E:0,A:0,N:0 }, reason_short: "parse_fail" };
  }
}

// ====== Apply score ======
function applyScores(delta, noPenalty) {
  // delta: 0..2
  // noPenaltyは「減点なし」だが、そもそもdeltaが0..2なので通常と同じ。
  // 将来「-2..+2」に拡張したい場合に備えて引数だけ残す。

  for (const t of TRAITS) {
    state.scores[t] = clamp(state.scores[t] + (delta[t] ?? 0), 0, 10);
  }
}

// ====== Progress ======
async function onNext() {
  const scene = SCENES[state.sceneIndex];
  const answer = $answerInput.value.trim();

  // 文字数はmaxlengthで制限済みだが、念のため
  if (answer.length === 0) {
    $hintLabel.textContent = "何か入力してください。";
    return;
  }

  // Scene0: route decide only
 
  // Scene1..5: LLM scoring
 const sceneText =
  typeof scene.text === "function"
    ? scene.text()
    : scene.text;

const result = await scoreWithLLM(sceneText, answer, !!scene.noPenalty);


  state.history.push({
    scene: scene.id,
    answer,
    llm: result,
  });

  if (result.invalid) {
    // 暗黙エンド14へ
    const fall = window.ENDING_FALL;
    showEnding({ ...fall, distance: "-" });
    renderDebug();
    return;
  }

  applyScores(result.scores, !!scene.noPenalty);

  // 次へ or ending
  if (scene.id < 5) {
    state.sceneIndex += 1;
    updateUI();
    return;
  }

  // Scene5終了 → 最終エンド決定
  const ending = pickBestEnding();
  if (!ending) {
    const fall = window.ENDING_FALL;
    showEnding({ ...fall, distance: "-" });
  } else {
    showEnding(ending);
  }
  renderDebug();
}

// ====== Events ======
$answerInput.addEventListener("input", () => {
  $countLabel.textContent = `${$answerInput.value.length}/200`;
});

$nextBtn.addEventListener("click", () => { onNext(); });
$resetBtn.addEventListener("click", () => {
  $nextBtn.disabled = false;
  resetAll();
});
function goRoute(routeKey) {
  state.route = routeKey;
  state.history.push({ scene: 0, route: routeKey, answer: "(button)" });
  state.sceneIndex = 1;
  $nextBtn.disabled = false;
  updateUI();
}

$routeA.addEventListener("click", () => goRoute("A"));
$routeB.addEventListener("click", () => goRoute("B"));
$routeC.addEventListener("click", () => goRoute("C"));


$debugToggle.addEventListener("change", renderDebug);

// ====== Init ======
updateUI();

