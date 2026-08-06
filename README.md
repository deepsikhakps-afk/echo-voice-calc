# Echo — Voice-Controlled Calculator & Assistant

A no-database, browser-only calculator you can talk to. Say a sum, a unit conversion, or a quick math question out loud — Echo transcribes it, computes the answer, speaks it back, and logs it. A manual keypad and typed-example chips are included as fallbacks for browsers/devices without microphone access.

## Featuresss
- **Voice input** via the Web Speech API (`SpeechRecognition`) — no server, no third-party STT service
- **Voice output** via `SpeechSynthesis` — Echo reads the answer back to you
- **Live waveform visualization** while listening (real mic input via `AudioContext`/`AnalyserNode`, with an idle animated fallback)
- **Natural language parsing**:
  - Spoken numbers → digits ("twelve" → `12`, "one hundred" → `100`)
  - Spoken operators → symbols ("plus", "times", "divided by", "modulo", etc.)
  - Unit conversions: *"convert 5 kilometers to miles"*, *"10 kg to pounds"*, *"30 celsius to fahrenheit"*
  - Special functions: square root, squared, cubed, percentage of
- **On-screen keypad** for manual entry, and clickable example chips to try common phrases instantly
- **Command log** — a running history of the last 12 calculations understood
- **Distinctive dark UI** — glowing accent, pulsing mic button, monospace result display
## Tech Stack