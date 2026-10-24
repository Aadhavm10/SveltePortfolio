/**
 * Shared input state. Keyboard and on-screen touch controls both write here;
 * the player controller reads it every frame.
 */
export const input = {
  stickX: 0,
  stickZ: 0,
  stickActive: false,
  kickButton: false,
  /** Set to respawn the ball at the player's feet; consumed by the player controller. */
  resetBall: false
};

const keys = new Set<string>();

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0]
};

export interface MoveInput {
  x: number;
  z: number;
  /** 0..1 */
  amount: number;
  sprint: boolean;
}

export function readMove(): MoveInput {
  if (input.stickActive) {
    const amount = Math.min(1, Math.hypot(input.stickX, input.stickZ));
    const len = Math.hypot(input.stickX, input.stickZ) || 1;
    return {
      x: input.stickX / len,
      z: input.stickZ / len,
      amount: amount < 0.15 ? 0 : amount,
      sprint: amount > 0.92
    };
  }

  let x = 0;
  let z = 0;
  keys.forEach((code) => {
    const dir = MOVE_KEYS[code];
    if (dir) {
      x += dir[0];
      z += dir[1];
    }
  });
  const len = Math.hypot(x, z);
  return {
    x: len ? x / len : 0,
    z: len ? z / len : 0,
    amount: len ? 1 : 0,
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight')
  };
}

export function isShootHeld() {
  return keys.has('Space') || input.kickButton;
}

export function clearInput() {
  keys.clear();
  input.stickX = 0;
  input.stickZ = 0;
  input.stickActive = false;
  input.kickButton = false;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Buttons, links and the info panel keep their native Space/arrow behaviour. */
function isNativeTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('a, button, .world-panel') !== null;
}

/** Tracks held keys. Returns a cleanup function. */
export function bindKeyboard() {
  const onDown = (e: KeyboardEvent) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.code in MOVE_KEYS || e.code === 'Space') && !isNativeTarget(e.target)) e.preventDefault();
    keys.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', clearInput);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', clearInput);
  };
}
