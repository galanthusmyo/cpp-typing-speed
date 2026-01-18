/* C++ Lab Typer (GitHub auto-loader) */

const GH_OWNER = "acs-aburada";
const GH_REPO = "oop-2025";
const GH_BRANCH = "main";

// GitHub APIs
const GH_TREE_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/trees/${GH_BRANCH}?recursive=1`;
const GH_RAW_BASE = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/`;

const fileSelect = document.getElementById("fileSelect");
const btnRandom = document.getElementById("btnRandom");
const btnLoadGithub = document.getElementById("btnLoadGithub");

const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const btnFinish = document.getElementById("btnFinish");

const typing = document.getElementById("typing");
const reference = document.getElementById("reference");

const chipFile = document.getElementById("chipFile");
const chipChars = document.getElementById("chipChars");
const chipLines = document.getElementById("chipLines");

const statTime = document.getElementById("statTime");
const statWpmGross = document.getElementById("statWpmGross");
const statWpmNet = document.getElementById("statWpmNet");
const statAcc = document.getElementById("statAcc");
const statErr = document.getElementById("statErr");
const statErrRate = document.getElementById("statErrRate");
const statProg = document.getElementById("statProg");

const resultBox = document.getElementById("resultBox");
const rankBadge = document.getElementById("rankBadge");
const finalTime = document.getElementById("finalTime");
const finalGross = document.getElementById("finalGross");
const finalNet = document.getElementById("finalNet");
const finalAcc = document.getElementById("finalAcc");
const finalErr = document.getElementById("finalErr");
const finalErrRate = document.getElementById("finalErrRate");
const bestScore = document.getElementById("bestScore");

const btnAgain = document.getElementById("btnAgain");
const btnCloseResult = document.getElementById("btnCloseResult");

const btnHelp = document.getElementById("btnHelp");
const helpModal = document.getElementById("helpModal");
const btnCloseHelp = document.getElementById("btnCloseHelp");

// State
let cppPaths = [];            // list of repo paths: "lab_01/xxx.cpp"
let fileCache = new Map();    // path -> text
let targetText = "";
let currentFileName = "";

let started = false;
let finished = false;
let startTs = 0;
let rafId = 0;

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countLines(s) {
  if (!s) return 0;
  return s.split("\n").length;
}

function formatSeconds(sec) {
  return `${sec.toFixed(2)}s`;
}

function calcStats(typed, target, seconds) {
  const typedLen = typed.length;
  const targetLen = target.length;
  const minLen = Math.min(typedLen, targetLen);

  let correct = 0;
  let incorrect = 0;

  for (let i = 0; i < minLen; i++) {
    if (typed[i] === target[i]) correct++;
    else incorrect++;
  }

  const extra = Math.max(0, typedLen - targetLen);
  incorrect += extra;

  const minutes = Math.max(0.001, seconds / 60);

  const grossWpm = (typedLen / 5) / minutes;
  const netWpm = (correct / 5) / minutes;

  const accuracy = typedLen === 0 ? 100 : (correct / typedLen) * 100;
  const errorRate = typedLen === 0 ? 0 : (incorrect / typedLen) * 100;
  const progress = targetLen === 0 ? 0 : (Math.min(typedLen, targetLen) / targetLen) * 100;

  return {
    typedLen,
    targetLen,
    correct,
    incorrect,
    grossWpm,
    netWpm,
    accuracy,
    errorRate,
    progress
  };
}

function getRank(netWpm, accuracy) {
  if (netWpm >= 85 && accuracy >= 97) return { name: "👑 Godlike", color: "rgba(255,204,102,.22)" };
  if (netWpm >= 70) return { name: "⚡ Beast", color: "rgba(109,123,255,.22)" };
  if (netWpm >= 55) return { name: "🔥 Fast", color: "rgba(60,255,106,.16)" };
  if (netWpm >= 40) return { name: "💻 Dev", color: "rgba(255,204,102,.18)" };
  if (netWpm >= 25) return { name: "🧪 Junior", color: "rgba(255,255,255,.10)" };
  return { name: "🐌 Turtle", color: "rgba(255,60,78,.14)" };
}

function renderReference(typed, target) {
  if (!target) return "(Select a file to begin)";

  const tLen = target.length;
  const typedLen = typed.length;

  let out = "";

  for (let i = 0; i < tLen; i++) {
    const ch = target[i];
    const safe = escapeHtml(ch);

    let cls = "pending";
    if (i < typedLen) cls = (typed[i] === ch) ? "ok" : "bad";
    if (i === typedLen && !finished) cls += " cursor";

    out += `<span class="${cls}">${safe}</span>`;
  }

  if (typedLen > tLen) {
    const extra = typed.slice(tLen);
    out += `<span class="bad">${escapeHtml(extra)}</span>`;
  }

  return out;
}

function setUiEnabled(enabled) {
  btnStart.disabled = !enabled;
  btnReset.disabled = !enabled;
  btnFinish.disabled = !enabled;
  typing.disabled = !enabled;
}

function resetRun(keepFile = true) {
  cancelAnimationFrame(rafId);

  started = false;
  finished = false;
  startTs = 0;

  typing.value = "";
  typing.scrollTop = 0;

  resultBox.hidden = true;

  statTime.textContent = "0.00s";
  statWpmGross.textContent = "0";
  statWpmNet.textContent = "0";
  statAcc.textContent = "100%";
  statErr.textContent = "0";
  statErrRate.textContent = "0%";
  statProg.textContent = "0%";

  if (!keepFile) {
    targetText = "";
    currentFileName = "";
    chipFile.textContent = "No file loaded";
    chipChars.textContent = "0 chars";
    chipLines.textContent = "0 lines";
    reference.textContent = "(Loading from GitHub…)";
    setUiEnabled(false);
  } else {
    reference.innerHTML = renderReference("", targetText);
    setUiEnabled(!!targetText);
  }
}

function updateLoop() {
  if (!started || finished) return;

  const now = performance.now();
  const seconds = (now - startTs) / 1000;

  const typed = typing.value;
  const stats = calcStats(typed, targetText, seconds);

  statTime.textContent = formatSeconds(seconds);
  statWpmGross.textContent = Math.max(0, Math.round(stats.grossWpm));
  statWpmNet.textContent = Math.max(0, Math.round(stats.netWpm));
  statAcc.textContent = `${Math.max(0, Math.min(100, stats.accuracy)).toFixed(1)}%`;
  statErr.textContent = `${stats.incorrect}`;
  statErrRate.textContent = `${Math.max(0, Math.min(100, stats.errorRate)).toFixed(1)}%`;
  statProg.textContent = `${Math.min(100, stats.progress).toFixed(1)}%`;

  reference.innerHTML = renderReference(typed, targetText);

  if (typed.length >= targetText.length && targetText.length > 0) {
    finishRun();
    return;
  }

  rafId = requestAnimationFrame(updateLoop);
}

function startRun() {
  if (!targetText) return;

  if (!started) {
    started = true;
    finished = false;
    startTs = performance.now();

    resultBox.hidden = true;

    typing.disabled = false;
    typing.focus();

    rafId = requestAnimationFrame(updateLoop);
  }
}

function finishRun() {
  if (!started || finished) return;

  finished = true;
  cancelAnimationFrame(rafId);

  const seconds = (performance.now() - startTs) / 1000;
  const typed = typing.value;
  const stats = calcStats(typed, targetText, seconds);

  const gross = Math.max(0, Math.round(stats.grossWpm));
  const net = Math.max(0, Math.round(stats.netWpm));
  const acc = Math.max(0, Math.min(100, stats.accuracy));
  const errRate = Math.max(0, Math.min(100, stats.errorRate));

  const rank = getRank(net, acc);

  resultBox.hidden = false;
  rankBadge.textContent = rank.name;
  rankBadge.style.background = rank.color;

  finalTime.textContent = formatSeconds(seconds);
  finalGross.textContent = `${gross}`;
  finalNet.textContent = `${net}`;
  finalAcc.textContent = `${acc.toFixed(1)}%`;
  finalErr.textContent = `${stats.incorrect}`;
  finalErrRate.textContent = `${errRate.toFixed(1)}%`;

  // Save best score per file
  const key = `labtyper_best_${currentFileName}`;
  const prev = localStorage.getItem(key);
  const current = { net, gross, acc: Number(acc.toFixed(1)), time: Number(seconds.toFixed(2)) };

  let best = current;
  if (prev) {
    try {
      const p = JSON.parse(prev);
      const better =
        (current.net > p.net) ||
        (current.net === p.net && current.acc > p.acc) ||
        (current.net === p.net && current.acc === p.acc && current.time < p.time);
      best = better ? current : p;
    } catch {}
  }
  localStorage.setItem(key, JSON.stringify(best));
  bestScore.textContent = `${best.net} net | ${best.acc}% | ${best.time}s`;

  typing.disabled = true;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github+json" }
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${msg || res.statusText}`);
  }
  return res.json();
}

async function fetchRaw(path) {
  const url = GH_RAW_BASE + path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch raw file: ${path}`);
  const text = await res.text();
  return text.replaceAll("\r\n", "\n");
}

function setDropdownLoading(text) {
  fileSelect.disabled = true;
  fileSelect.innerHTML = `<option value="">${text}</option>`;
}

function populateDropdown(paths) {
  fileSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select a .cpp file…";
  fileSelect.appendChild(opt0);

  for (const p of paths) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    fileSelect.appendChild(opt);
  }

  fileSelect.disabled = false;
  btnRandom.disabled = paths.length === 0;
}

async function loadCppListFromGitHub() {
  resetRun(false);
  setDropdownLoading("Loading .cpp files from GitHub…");
  btnRandom.disabled = true;

  try {
    const tree = await fetchJson(GH_TREE_API);

    const files = (tree.tree || [])
      .filter(x => x.type === "blob" && typeof x.path === "string")
      .map(x => x.path);

    cppPaths = files
      .filter(p => p.toLowerCase().endsWith(".cpp"))
      .sort((a, b) => a.localeCompare(b));

    if (cppPaths.length === 0) {
      populateDropdown([]);
      reference.textContent = "(No .cpp files found in this repository)";
      return;
    }

    populateDropdown(cppPaths);
    reference.textContent = "(Select a file to begin)";
  } catch (e) {
    console.error(e);
    populateDropdown([]);
    reference.textContent =
      "Failed to load from GitHub. Possible rate limit.\n\nTry again using 'Reload from GitHub'.";
  }
}

async function loadFileByPath(path) {
  if (!path) return;

  currentFileName = path;
  chipFile.textContent = currentFileName;

  // cached?
  if (!fileCache.has(path)) {
    reference.textContent = "(Fetching file content...)";
    const text = await fetchRaw(path);
    fileCache.set(path, text);
  }

  targetText = fileCache.get(path);

  chipChars.textContent = `${targetText.length} chars`;
  chipLines.textContent = `${countLines(targetText)} lines`;

  resetRun(true);
  setUiEnabled(true);
  btnStart.disabled = false;

  reference.innerHTML = renderReference("", targetText);
}

function pickRandomFile() {
  if (!cppPaths.length) return;
  const p = cppPaths[Math.floor(Math.random() * cppPaths.length)];
  fileSelect.value = p;
  loadFileByPath(p);
}

// TAB => 4 spaces in textarea
typing.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = typing.selectionStart;
    const end = typing.selectionEnd;
    const v = typing.value;
    typing.value = v.slice(0, start) + "    " + v.slice(end);
    typing.selectionStart = typing.selectionEnd = start + 4;
  }
});

// Start timer on first input
typing.addEventListener("input", () => {
  if (!started && !finished && targetText) {
    startRun();
  }
});

// UI events
btnLoadGithub.addEventListener("click", async () => {
  await loadCppListFromGitHub();
});

fileSelect.addEventListener("change", async () => {
  if (!fileSelect.value) return;
  await loadFileByPath(fileSelect.value);
});

btnRandom.addEventListener("click", () => pickRandomFile());

btnStart.addEventListener("click", () => startRun());

btnReset.addEventListener("click", () => {
  resetRun(true);
  typing.focus();
});

btnFinish.addEventListener("click", () => finishRun());

btnAgain.addEventListener("click", () => {
  resetRun(true);
  typing.focus();
});

btnCloseResult.addEventListener("click", () => {
  resultBox.hidden = true;
});

// Help modal
btnHelp.addEventListener("click", () => helpModal.hidden = false);
btnCloseHelp.addEventListener("click", () => helpModal.hidden = true);
helpModal.addEventListener("click", (e) => {
  if (e.target === helpModal) helpModal.hidden = true;
});

// Boot
resetRun(false);
loadCppListFromGitHub();
