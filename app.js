// ---- app.js: wires up UI, mic button, keypad, waveform, command log ----

const micBtn = document.getElementById("micBtn");
const micStatus = document.getElementById("micStatus");
const heardEl = document.getElementById("heard");
const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const logList = document.getElementById("logList");
const waveformCanvas = document.getElementById("waveform");
const keypad = document.getElementById("keypad");

let keypadBuffer = "";
let audioCtx, analyser, dataArray, animationId, mediaStream;

// ---------- Result / log rendering ----------
function showResult(expression, result, spoken) {
  expressionEl.textContent = expression;
  resultEl.textContent = formatNumber(result);
  addLogEntry(expression, result);
  if (spoken) SpeechModule.speak(`That's ${formatNumber(result)}`);
}

function showError(message, spoken) {
  expressionEl.textContent = message;
  resultEl.textContent = "—";
  if (spoken) SpeechModule.speak("Sorry, I didn't catch a calculation there.");
}

function formatNumber(n) {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function addLogEntry(expression, result) {
  const li = document.createElement("li");
  const left = document.createElement("span");
  left.textContent = expression;
  const right = document.createElement("span");
  right.className = "result-val";
  right.textContent = formatNumber(result);
  li.appendChild(left);
  li.appendChild(right);
  logList.prepend(li);
  while (logList.children.length > 12) logList.removeChild(logList.lastChild);
}

// ---------- Speech wiring ----------
if (SpeechModule.isSupported()) {
  SpeechModule.init({
    onStart: () => {
      micBtn.classList.add("listening");
      micStatus.textContent = "listening…";
      micStatus.className = "mic-status active";
      heardEl.textContent = "Listening…";
      startWaveform();
    },
    onEnd: () => {
      micBtn.classList.remove("listening");
      micStatus.textContent = "idle";
      micStatus.className = "mic-status";
      stopWaveform();
    },
    onError: (err) => {
      micBtn.classList.remove("listening");
      micStatus.textContent = err === "not-allowed" ? "mic blocked" : "error";
      micStatus.className = "mic-status error";
      stopWaveform();
    },
    onResult: ({ final, interim }) => {
      heardEl.textContent = `"${final || interim}"`;
      if (final) {
        const parsed = CalcEngine.parse(final);
        if (parsed) showResult(parsed.expression, parsed.result, true);
        else showError(`Couldn't parse: "${final}"`, true);
      }
    }
  });

  micBtn.addEventListener("click", () => {
    if (SpeechModule.listening) {
      SpeechModule.stop();
    } else {
      requestMicPermissionAndVisualize();
      SpeechModule.start();
    }
  });
} else {
  micStatus.textContent = "unsupported browser";
  micBtn.disabled = true;
  micBtn.style.opacity = 0.4;
}

// ---------- Waveform visualization ----------
async function requestMicPermissionAndVisualize() {
  try {
    if (!audioCtx) {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
  } catch {
    // Mic visualization is optional; recognition can still work without it in some browsers
  }
}

function startWaveform() {
  if (!analyser) { drawIdleWave(); return; }
  const ctx = waveformCanvas.getContext("2d");
  const w = waveformCanvas.width, h = waveformCanvas.height;

  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#38e6c5";
    ctx.beginPath();
    const sliceWidth = w / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
  }
  draw();
}

function drawIdleWave() {
  const ctx = waveformCanvas.getContext("2d");
  const w = waveformCanvas.width, h = waveformCanvas.height;
  let t = 0;
  function draw() {
    animationId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#38e6c5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h/2 + Math.sin((x + t) * 0.05) * 10;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    t += 2;
  }
  draw();
}

function stopWaveform() {
  if (animationId) cancelAnimationFrame(animationId);
  const ctx = waveformCanvas.getContext("2d");
  ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
}

// ---------- Keypad fallback ----------
keypad.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const key = btn.dataset.key;

  if (key === "clear") {
    keypadBuffer = "";
    expressionEl.textContent = "\u00A0";
    resultEl.textContent = "0";
    return;
  }

  if (key === "=") {
    const parsed = CalcEngine.parse(keypadBuffer);
    if (parsed) {
      showResult(parsed.expression, parsed.result, false);
    } else {
      showError("Invalid expression", false);
    }
    keypadBuffer = "";
    return;
  }

  keypadBuffer += key;
  expressionEl.textContent = keypadBuffer;
});

// ---------- Hint chips ----------
document.querySelectorAll(".hint").forEach(btn => {
  btn.addEventListener("click", () => {
    const text = btn.textContent.replace(/"/g, "");
    heardEl.textContent = `"${text}"`;
    const parsed = CalcEngine.parse(text);
    if (parsed) showResult(parsed.expression, parsed.result, false);
    else showError(`Couldn't parse: "${text}"`, false);
  });
});
