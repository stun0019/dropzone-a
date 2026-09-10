import { runtime } from "./runtime.js";

export function endJoy(e) {
  if (e.pointerId !== runtime.joyPointer) return;
  runtime.joyPointer = null;
  runtime.joyVec = { x: 0, y: 0 };
  runtime.stick.style.transform = "translate(-50%,-50%)";
}

export function setBet(value) {
  runtime.selectedBet = runtime.clamp(Math.round(value), 1, 20);
  if (runtime.G) runtime.G.bet = runtime.selectedBet;
  runtime.$("betValue").textContent = runtime.selectedBet;
}
