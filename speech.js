// ---- speech.js: wraps Web Speech API (recognition + synthesis) ----

const SpeechModule = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;

  function isSupported() {
    return !!SpeechRecognition;
  }

  function init({ onResult, onStart, onEnd, onError, onVolume }) {
    if (!isSupported()) return null;

    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { listening = true; onStart && onStart(); };
    recognition.onend = () => { listening = false; onEnd && onEnd(); };
    recognition.onerror = (e) => { listening = false; onError && onError(e.error); };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interim += transcript;
      }
      onResult && onResult({ final: finalTranscript.trim(), interim: interim.trim() });
    };

    return recognition;
  }

  function start() {
    if (recognition && !listening) recognition.start();
  }

  function stop() {
    if (recognition && listening) recognition.stop();
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  }

  return { isSupported, init, start, stop, speak, get listening() { return listening; } };
})();
