export function drawNeonGridBackground(ctx, W, H, time = 0, opts = {}) {
  const {
    top = 0,
    bottom = H,
    gridStep = 60,
    gridColor = 'rgba(155,255,240,0.06)',
    bgStops = ['#0c211d', '#071713', '#06100f'],
    nebula = true,
    stars = true,
    starCount = 140,
  } = opts;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stops = bgStops.length ? bgStops : ['#0c211d', '#071713', '#06100f'];
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (nebula) {
    const blob = (x, y, r, color) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(W * 0.22 + Math.sin(time * 0.17) * 30, H * 0.28, Math.min(W, H) * 0.35, 'rgba(0,224,165,0.11)');
    blob(W * 0.78, H * 0.42 + Math.cos(time * 0.13) * 20, Math.min(W, H) * 0.3, 'rgba(36,185,155,0.12)');
  }

  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  const startX = 0;
  const endX = W;
  for (let x = startX; x <= endX; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = top; y <= bottom; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  if (stars) {
    // deterministic-ish stars based on size so not flickering randomly each frame unless desired
    // draw a subtle starfield; callers can also manage their own stars
    const seed = 1337;
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < starCount; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const size = rand() < 0.12 ? 2 : 1;
      const tw = 0.55 + 0.45 * Math.sin(time * (1.2 + (i % 7) * 0.3) + i);
      ctx.globalAlpha = (0.25 + rand() * 0.5) * tw;
      ctx.fillStyle = size > 1 ? '#baffeb' : '#f2fffc';
      ctx.fillRect(x, y, size, size);
      if (size > 1) { ctx.globalAlpha *= 0.35; ctx.fillRect(x - 2, y, 5, 1); }
    }
    ctx.globalAlpha = 1;
  }
}

export function drawGroundGlow(ctx, W, groundY, time = 0, color = '#69f8c7') {
  const g = ctx.createLinearGradient(0, groundY - 5, 0, groundY + 10);
  g.addColorStop(0, color);
  g.addColorStop(0.2, 'rgba(46,189,156,0.8)');
  g.addColorStop(1, 'rgba(18,56,42,0)');
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY - 2, W, 8);
  ctx.restore();
}
