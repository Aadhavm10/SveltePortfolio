import { readMove } from '../input';
import { playBlip, playTick } from '../sound';
import { DISPLAY_FONT, FONT } from '../textures';

/**
 * The laptop arcade: a menu and two small games drawn onto the laptop screen.
 * Arrow keys / WASD steer, Enter starts and restarts, Escape goes back to the menu.
 */

export const GAMES = [
  { id: 'snake', title: 'Snake', blurb: 'Eat the mangoes. Do not bite your tail.' },
  { id: 'bricks', title: 'Brick breaker', blurb: 'Bounce the ball and clear the wall.' }
] as const;

type GameId = (typeof GAMES)[number]['id'];
type Ctx = CanvasRenderingContext2D;

export const ARCADE_W = 960;
export const ARCADE_H = 600;
const TOP = 72;

// Snake board
const CELL = 40;
const COLS = 24;
const ROWS = 13;

// Brick breaker
const PADDLE_W = 150;
const PADDLE_Y = 560;
const BALL_R = 10;
const BRICK_COLS = 8;
const BRICK_ROWS = 5;
const BRICK_W = 104;
const BRICK_H = 30;
const BRICK_GAP = 8;
const BRICK_LEFT = (ARCADE_W - (BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP)) / 2;
const BRICK_TOP = 110;
const BRICK_COLORS = ['#ff8a7a', '#ffc25c', '#f6e27a', '#79c37d', '#7cc8e4'];

const loadBest = (id: GameId) => {
  try {
    return Number(localStorage.getItem(`world-arcade-${id}`)) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (id: GameId, value: number) => {
  try {
    localStorage.setItem(`world-arcade-${id}`, String(value));
  } catch {
    // Private mode: the best score just isn't remembered.
  }
};

const snake = {
  cells: [] as [number, number][],
  dir: [1, 0] as [number, number],
  queue: [] as [number, number][],
  food: [0, 0] as [number, number],
  acc: 0,
  score: 0,
  over: false,
  best: 0
};

const bricks = {
  paddle: ARCADE_W / 2,
  ball: { x: 0, y: 0, vx: 0, vy: 0, stuck: true },
  alive: [] as boolean[],
  lives: 3,
  score: 0,
  over: false,
  won: false,
  best: 0
};

export const arcade = {
  screen: 'menu' as 'menu' | GameId,
  menu: 0,
  time: 0,
  /** Held direction from the on-screen buttons (touch), -1, 0 or 1. */
  touchX: 0
};

function placeFood() {
  for (let tries = 0; tries < 500; tries++) {
    const cell: [number, number] = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
    if (!snake.cells.some(([x, y]) => x === cell[0] && y === cell[1])) {
      snake.food = cell;
      return;
    }
  }
}

function startSnake() {
  snake.cells = [
    [6, 6],
    [5, 6],
    [4, 6]
  ];
  snake.dir = [1, 0];
  snake.queue = [];
  snake.acc = 0;
  snake.score = 0;
  snake.over = false;
  snake.best = loadBest('snake');
  placeFood();
}

function startBricks() {
  bricks.paddle = ARCADE_W / 2;
  bricks.alive = Array(BRICK_COLS * BRICK_ROWS).fill(true);
  bricks.lives = 3;
  bricks.score = 0;
  bricks.over = false;
  bricks.won = false;
  bricks.best = loadBest('bricks');
  resetBall();
}

function resetBall() {
  bricks.ball = { x: bricks.paddle, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0, stuck: true };
}

function launch() {
  if (!bricks.ball.stuck) return;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
  bricks.ball.vx = Math.cos(angle) * 430;
  bricks.ball.vy = Math.sin(angle) * 430;
  bricks.ball.stuck = false;
  playBlip(660);
}

/** Arrow press (once per key press). */
export function arcadePress(dx: number, dy: number) {
  if (arcade.screen === 'menu') {
    if (dy) {
      arcade.menu = (arcade.menu + dy + GAMES.length) % GAMES.length;
      playTick();
    }
    return;
  }
  if (arcade.screen === 'snake') {
    const last = snake.queue[snake.queue.length - 1] ?? snake.dir;
    const next: [number, number] = dx ? [dx, 0] : [0, dy];
    // No turning straight back into yourself; buffer up to two quick turns.
    if (next[0] === -last[0] && next[1] === -last[1]) return;
    if (next[0] === last[0] && next[1] === last[1]) return;
    if (snake.queue.length < 2) snake.queue.push(next);
    return;
  }
  if (arcade.screen === 'bricks' && dy < 0) launch();
}

/** Enter: start the highlighted game, restart after a game over, or launch the ball. */
export function arcadeEnter() {
  if (arcade.screen === 'menu') {
    arcade.screen = GAMES[arcade.menu].id;
    if (arcade.screen === 'snake') startSnake();
    else startBricks();
    playBlip(880);
    return;
  }
  if (arcade.screen === 'snake' && snake.over) startSnake();
  else if (arcade.screen === 'bricks') {
    if (bricks.over || bricks.won) startBricks();
    else launch();
  }
}

/** Escape inside a game returns to the menu. Returns false when already on the menu. */
export function arcadeBack() {
  if (arcade.screen === 'menu') return false;
  arcade.screen = 'menu';
  playTick();
  return true;
}

function updateSnake(dt: number) {
  if (snake.over) return;
  const interval = Math.max(0.065, 0.13 - snake.score * 0.003);
  snake.acc += dt;
  while (snake.acc >= interval) {
    snake.acc -= interval;
    if (snake.queue.length) snake.dir = snake.queue.shift()!;
    const [hx, hy] = snake.cells[0];
    const head: [number, number] = [(hx + snake.dir[0] + COLS) % COLS, (hy + snake.dir[1] + ROWS) % ROWS];
    if (snake.cells.slice(0, -1).some(([x, y]) => x === head[0] && y === head[1])) {
      snake.over = true;
      if (snake.score > snake.best) saveBest('snake', (snake.best = snake.score));
      playBlip(180);
      return;
    }
    snake.cells.unshift(head);
    if (head[0] === snake.food[0] && head[1] === snake.food[1]) {
      snake.score++;
      placeFood();
      playBlip(990);
    } else {
      snake.cells.pop();
    }
  }
}

function updateBricks(dt: number) {
  if (bricks.over || bricks.won) return;
  const move = readMove().x || arcade.touchX;
  bricks.paddle = Math.max(PADDLE_W / 2, Math.min(ARCADE_W - PADDLE_W / 2, bricks.paddle + move * 680 * dt));
  const b = bricks.ball;
  if (b.stuck) {
    b.x = bricks.paddle;
    return;
  }
  // Sub-steps keep the ball from tunnelling through bricks.
  const steps = 4;
  for (let s = 0; s < steps; s++) {
    b.x += (b.vx * dt) / steps;
    b.y += (b.vy * dt) / steps;
    if (b.x < BALL_R || b.x > ARCADE_W - BALL_R) {
      b.vx = Math.abs(b.vx) * (b.x < BALL_R ? 1 : -1);
      playBlip(520);
    }
    if (b.y < TOP + BALL_R) {
      b.vy = Math.abs(b.vy);
      playBlip(520);
    }
    // Paddle: where the ball lands on it decides the bounce angle.
    if (b.vy > 0 && b.y > PADDLE_Y - BALL_R && b.y < PADDLE_Y + 10 && Math.abs(b.x - bricks.paddle) < PADDLE_W / 2 + BALL_R) {
      const hit = (b.x - bricks.paddle) / (PADDLE_W / 2);
      const speed = Math.min(640, Math.hypot(b.vx, b.vy) * 1.02);
      const angle = -Math.PI / 2 + hit * 1.0;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      playBlip(440);
    }
    for (let i = 0; i < bricks.alive.length; i++) {
      if (!bricks.alive[i]) continue;
      const x = BRICK_LEFT + (i % BRICK_COLS) * (BRICK_W + BRICK_GAP);
      const y = BRICK_TOP + Math.floor(i / BRICK_COLS) * (BRICK_H + BRICK_GAP);
      const nx = Math.max(x, Math.min(b.x, x + BRICK_W));
      const ny = Math.max(y, Math.min(b.y, y + BRICK_H));
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > BALL_R * BALL_R) continue;
      bricks.alive[i] = false;
      bricks.score += 10;
      if (Math.abs(b.x - nx) > Math.abs(b.y - ny)) b.vx = -b.vx;
      else b.vy = -b.vy;
      playBlip(760 + Math.floor(i / BRICK_COLS) * 60);
      break;
    }
  }
  if (b.y > ARCADE_H + BALL_R) {
    bricks.lives--;
    playBlip(200);
    if (bricks.lives <= 0) {
      bricks.over = true;
      if (bricks.score > bricks.best) saveBest('bricks', (bricks.best = bricks.score));
    } else resetBall();
  }
  if (bricks.alive.every((a) => !a)) {
    bricks.won = true;
    if (bricks.score > bricks.best) saveBest('bricks', (bricks.best = bricks.score));
  }
}

export function updateArcade(dt: number) {
  arcade.time += dt;
  if (arcade.screen === 'snake') updateSnake(Math.min(dt, 0.1));
  else if (arcade.screen === 'bricks') updateBricks(Math.min(dt, 0.05));
}

function header(ctx: Ctx, title: string, left: string, right: string) {
  ctx.fillStyle = '#2a2650';
  ctx.fillRect(0, 0, ARCADE_W, TOP);
  ctx.fillStyle = '#ffd28a';
  ctx.font = `600 34px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, ARCADE_W / 2, TOP / 2 + 2);
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(left, 28, TOP / 2 + 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b7b2e6';
  ctx.fillText(right, ARCADE_W - 28, TOP / 2 + 2);
}

function banner(ctx: Ctx, title: string, sub: string) {
  ctx.fillStyle = 'rgba(20, 18, 44, 0.72)';
  ctx.fillRect(0, TOP, ARCADE_W, ARCADE_H - TOP);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 64px ${DISPLAY_FONT}`;
  ctx.fillText(title, ARCADE_W / 2, ARCADE_H / 2 - 10);
  ctx.fillStyle = '#ffd28a';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(sub, ARCADE_W / 2, ARCADE_H / 2 + 52);
}

function mango(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, r * 0.82, r, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8a5c';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.25, cy + r * 0.35, r * 0.45, r * 0.5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5fae4d';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.9, r * 0.45, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(ctx: Ctx) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#a8dc8c' : '#b5e39a';
      ctx.fillRect(x * CELL, TOP + y * CELL, CELL, CELL);
    }
  }
  mango(ctx, snake.food[0] * CELL + CELL / 2, TOP + snake.food[1] * CELL + CELL / 2, 14);
  snake.cells.forEach(([x, y], i) => {
    const t = i / Math.max(1, snake.cells.length - 1);
    ctx.fillStyle = `hsl(${205 - t * 25}, 62%, ${52 + t * 10}%)`;
    ctx.beginPath();
    ctx.roundRect(x * CELL + 3, TOP + y * CELL + 3, CELL - 6, CELL - 6, i === 0 ? 14 : 10);
    ctx.fill();
  });
  // Eyes look where the snake is heading.
  const [hx, hy] = snake.cells[0];
  const cx = hx * CELL + CELL / 2;
  const cy = TOP + hy * CELL + CELL / 2;
  const [dx, dy] = snake.dir;
  for (const side of [-1, 1]) {
    const ex = cx + dx * 6 + -dy * side * 8;
    const ey = cy + dy * 6 + dx * side * 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1b3a';
    ctx.beginPath();
    ctx.arc(ex + dx * 2, ey + dy * 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  header(ctx, 'Snake', `Score ${snake.score}`, `Best ${Math.max(snake.best, snake.score)}`);
  if (snake.over) banner(ctx, 'Game over', 'Enter to play again  ·  Esc for the menu');
}

function drawBricks(ctx: Ctx) {
  const bg = ctx.createLinearGradient(0, TOP, 0, ARCADE_H);
  bg.addColorStop(0, '#2f2b5e');
  bg.addColorStop(1, '#4a3b6e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, TOP, ARCADE_W, ARCADE_H - TOP);
  bricks.alive.forEach((alive, i) => {
    if (!alive) return;
    const x = BRICK_LEFT + (i % BRICK_COLS) * (BRICK_W + BRICK_GAP);
    const y = BRICK_TOP + Math.floor(i / BRICK_COLS) * (BRICK_H + BRICK_GAP);
    ctx.fillStyle = BRICK_COLORS[Math.floor(i / BRICK_COLS)];
    ctx.beginPath();
    ctx.roundRect(x, y, BRICK_W, BRICK_H, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + 8, y + 5, BRICK_W - 16, 5);
  });
  ctx.fillStyle = '#fffaee';
  ctx.beginPath();
  ctx.roundRect(bricks.paddle - PADDLE_W / 2, PADDLE_Y, PADDLE_W, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd28a';
  ctx.beginPath();
  ctx.arc(bricks.ball.x, bricks.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  header(ctx, 'Brick breaker', `Score ${bricks.score}`, `Lives ${'●'.repeat(Math.max(0, bricks.lives))}`);
  if (bricks.ball.stuck && !bricks.over) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Enter to launch  ·  steer with the arrow keys', ARCADE_W / 2, 470);
  }
  if (bricks.over) banner(ctx, 'Game over', 'Enter to play again  ·  Esc for the menu');
  if (bricks.won) banner(ctx, 'You cleared it!', 'Enter to play again  ·  Esc for the menu');
}

function drawMenu(ctx: Ctx, active: boolean) {
  const bg = ctx.createLinearGradient(0, 0, ARCADE_W, ARCADE_H);
  bg.addColorStop(0, '#2f2b5e');
  bg.addColorStop(1, '#6b4a7e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
  // Twinkly pixel stars.
  for (let i = 0; i < 40; i++) {
    const x = (i * 263) % ARCADE_W;
    const y = (i * 151) % ARCADE_H;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * Math.abs(Math.sin(arcade.time * 1.5 + i))})`;
    ctx.fillRect(x, y, 4, 4);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd28a';
  ctx.font = `700 76px ${DISPLAY_FONT}`;
  ctx.fillText('Aadhav Arcade', ARCADE_W / 2, 118 + Math.sin(arcade.time * 2) * 4);
  GAMES.forEach((g, i) => {
    const y = 250 + i * 118;
    const on = i === arcade.menu;
    ctx.fillStyle = on ? '#fffaee' : 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(200, y - 46, ARCADE_W - 400, 92, 22);
    ctx.fill();
    ctx.fillStyle = on ? '#2f2b5e' : '#ffffff';
    ctx.font = `600 40px ${DISPLAY_FONT}`;
    ctx.fillText(g.title, ARCADE_W / 2, y - 12);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = on ? '#6b6390' : 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(g.blurb, ARCADE_W / 2, y + 22);
  });
  const blink = Math.sin(arcade.time * 4) > -0.3;
  ctx.fillStyle = `rgba(255, 255, 255, ${blink ? 0.9 : 0.3})`;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(active ? 'Up / down to choose  ·  Enter to play' : 'Walk up and press Enter to play', ARCADE_W / 2, 545);
}

export function drawArcade(ctx: Ctx, active: boolean) {
  ctx.save();
  ctx.scale(ctx.canvas.width / ARCADE_W, ctx.canvas.height / ARCADE_H);
  if (!active || arcade.screen === 'menu') drawMenu(ctx, active);
  else if (arcade.screen === 'snake') drawSnake(ctx);
  else drawBricks(ctx);
  ctx.restore();
}
