"use client";

import { play } from "./sfx";

// A voz do narrador: síntese de fala do próprio navegador, em português do Brasil.
// Cada navegador tem vozes diferentes; a melhor costuma ser uma neural ("Natural"/"Online" no Edge,
// "Google" no Chrome), então elas ganham prioridade sobre a voz padrão do sistema.

let voice: SpeechSynthesisVoice | null = null;

function score(v: SpeechSynthesisVoice) {
  let s = v.lang === "pt-BR" ? 20 : v.lang.toLowerCase().startsWith("pt") ? 8 : -100;
  if (/natural|neural|online/i.test(v.name)) s += 12;
  if (/google/i.test(v.name)) s += 6;
  if (/antonio|daniel|humberto|donato|fabio|julio/i.test(v.name)) s += 2;
  return s;
}

function pickVoice() {
  if (voice) return voice;
  const voices = window.speechSynthesis.getVoices();
  const best = [...voices].sort((a, b) => score(b) - score(a))[0];
  voice = best && score(best) > 0 ? best : null;
  return voice;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // As vozes chegam depois do carregamento; quando chegarem, escolhe de novo.
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    voice = null;
  });
}

export function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Fala como locutor; nos lances grandes, a torcida sobe junto. */
export function speak(text: string, crowd = false) {
  if (!speechAvailable()) return;
  const synth = window.speechSynthesis;
  // Se o narrador ficou para trás, pula o que estava na fila: ele sempre fala do lance mais recente.
  if (synth.pending) synth.cancel();
  const u = new SpeechSynthesisUtterance(text.toLocaleLowerCase("pt-BR"));
  u.lang = "pt-BR";
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.08;
  u.pitch = 0.92;
  synth.speak(u);
  if (crowd) play("torcida");
}

export function silence() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
