import { runtime } from "./runtime.js";

export function initAudio() {
  if (!runtime.gameAudio.enabled) return;
  try {
    if (!runtime.gameAudio.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      runtime.gameAudio.ctx = new Audio();
      runtime.gameAudio.master = runtime.gameAudio.ctx.createGain();
      runtime.gameAudio.master.gain.value = 0.22;
      runtime.gameAudio.compressor = runtime.gameAudio.ctx.createDynamicsCompressor();
      runtime.gameAudio.compressor.threshold.value = -22;
      runtime.gameAudio.compressor.knee.value = 18;
      runtime.gameAudio.compressor.ratio.value = 5;
      runtime.gameAudio.compressor.attack.value = .006;
      runtime.gameAudio.compressor.release.value = .18;
      runtime.gameAudio.master.connect(runtime.gameAudio.compressor);
      runtime.gameAudio.compressor.connect(runtime.gameAudio.ctx.destination);
    }
    if (runtime.gameAudio.ctx.state === "suspended")
      runtime.gameAudio.ctx.resume().catch(() => {});
  } catch (e) {
    runtime.gameAudio.enabled = false;
    runtime.$("audioButton").textContent = "聲音 OFF";
  }
}

function noiseBurst(time, duration = .18, volume = .12, cutoff = 1500) {
  const a = runtime.gameAudio;
  if (!a.ctx || !a.enabled || a.ctx.state !== "running") return;
  if (!a.noiseBuffer) {
    const length = Math.floor(a.ctx.sampleRate * .5);
    a.noiseBuffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
    const data = a.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = a.ctx.createBufferSource();
  const filter = a.ctx.createBiquadFilter();
  const gain = a.ctx.createGain();
  source.buffer = a.noiseBuffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(100, cutoff * .25), time + duration);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
  source.connect(filter); filter.connect(gain); gain.connect(a.master);
  source.start(time); source.stop(time + duration + .02);
}

export function tone(
  freq,
  time,
  duration,
  volume = 0.1,
  type = "triangle",
  endFreq = null,
) {
  const a = runtime.gameAudio;
  if (!a.ctx || !a.enabled || a.ctx.state !== "running") return;
  const osc = a.ctx.createOscillator(),
    gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (endFreq)
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(a.master);
  osc.start(time);
  osc.stop(time + duration + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

export function sound(name) {
  const a = runtime.gameAudio;
  if (!a.ctx || !a.enabled || document.hidden || a.ctx.state !== "running")
    return;
  const t = a.ctx.currentTime;
  if (t - (a.last[name] ?? -100) < (name === "knock" ? 0.18 : 0.09)) return;
  a.last[name] = t;
  if (name === "supply") {
    tone(740, t, 0.16, 0.16, "sine");
    tone(988, t + 0.2, 0.22, 0.13, "sine");
  } else if (name === "capture" || name === "pickup" || name === "equip") {
    tone(440, t, 0.12, 0.12);
    tone(660, t + 0.07, 0.19, 0.1);
  } else if (name === "boss" || name === "bosswin") {
    noiseBurst(t, .5, .09, 700);
    tone(100, t, 0.6, 0.2, "sawtooth", 45);
    tone(name === "bosswin" ? 880 : 180, t + 0.25, 0.4, 0.12);
  } else if (name === "explosion") {
    noiseBurst(t, .35, .24, 1200);
    tone(95, t, 0.35, 0.24, "sawtooth", 22);
  } else if (name === "impact") {
    noiseBurst(t, .08, .07, 2200);
    tone(180, t, .08, .045, "triangle", 70);
  } else if (name === "laser") {
    tone(1100, t, 0.13, 0.055, "sine", 320);
  } else if (name === "grenade") {
    tone(240, t, 0.12, 0.08, "triangle", 80);
  } else if (name === "knock") {
    tone(150, t, 0.12, 0.1, "triangle", 50);
  } else {
    tone(
      name === "rocket" ? 110 : name === "shotgun" ? 160 : 260,
      t,
      0.07,
      0.07,
      "sawtooth",
      45,
    );
  }
}

export function updateAudio() {
  const a = runtime.gameAudio;
  if (!a.ctx) return;
  const active =
    a.enabled &&
    !document.hidden &&
    runtime.state === "playing" &&
    !runtime.G?.choosing &&
    !runtime.tacticalPanel;
  a.master.gain.setTargetAtTime(active ? 0.22 : 0, a.ctx.currentTime, 0.04);
  if (!active) {
    a.next = 0;
    return;
  }
  if (a.ctx.state !== "running") return;
  const now = a.ctx.currentTime;
  if (!a.next || a.next < now - 0.3) a.next = now + 0.02;
  const bass = [55, 55, 65.41, 55, 49, 49, 43.65, 49];
  while (a.next < now + 0.12) {
    const beat = a.beat++,
      time = a.next,
      note = bass[Math.floor(beat / 4) % bass.length];
    tone(note, time, 0.22, 0.085, "triangle");
    if (beat % 4 === 0) tone(100, time, 0.1, 0.12, "sine", 30);
    if (beat % 4 === 2) tone(1600, time, 0.035, 0.025, "square", 400);
    if (beat % 8 === 6) tone(note * 2, time, .12, .018, "sine", note);
    if (beat % 2 === 0)
      tone(
        note * [4, 6, 8, 6][Math.floor(beat / 2) % 4],
        time,
        0.18,
        0.022,
        "sine",
      );
    a.next += 0.25;
  }
}
