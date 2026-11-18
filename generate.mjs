import { readFileSync, writeFileSync } from 'node:fs';

const local = name => new URL(name, import.meta.url);
const providers = JSON.parse(readFileSync(local('models.json'), 'utf8'));
const axes = ['Reasoning', 'Coding', 'Speed', 'Multimodal', 'Affordability'];
const initials = ['R', 'C', 'S', 'M', 'A'];
const angles = axes.map((_, i) => i * 2 * Math.PI / axes.length - Math.PI / 2);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const label = (x, y, value, size, color = '#f1f4f8', extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escape(value)}</text>`;
const rect = (x, y, w, h, color, radius = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"/>`;

function radar(scores, accent) {
  if (scores.length !== axes.length || scores.some(n => !Number.isFinite(n) || n < 0 || n > 5)) {
    throw new Error('Each model needs five scores between zero and five.');
  }
  const point = (i, r) => [Math.cos(angles[i]) * r, Math.sin(angles[i]) * r].map(v => v.toFixed(2));
  const polygon = (values, style) =>
    `<polygon points="${values.map((n, i) => point(i, 10 * n).join(',')).join(' ')}" ${style}/>`;
  const rings = [1, 2, 3, 4, 5].map(n => polygon(axes.map(() => n), 'fill="none" stroke="#354250"'));
  const spokes = axes.map((_, i) => `<path d="M0,0 L${point(i, 50)}" stroke="#354250"/>`);
  const letters = initials.map((s, i) => {
    const [x, y] = point(i, 64);
    return label(x, Number(y) + 4, s, 12, '#bdc7d2', 'text-anchor="middle"');
  });
  return [...rings, ...spokes, polygon(scores, `stroke="${accent}" stroke-width="2.5" fill="${accent}" fill-opacity=".24"`), ...letters].join('');
}

const margin = 44, column = 436, gap = 16, top = 174, header = 84, row = 154;
const width = 2 * margin + providers.length * column + (providers.length - 1) * gap;
const bottom = top + header + row * Math.max(...providers.map(p => p.models.length));
const height = bottom + 70;
function panel({ provider, family, accent, models }, i) {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('Expected a hex accent color.');
  const x = margin + i * (column + gap);
  const rows = models.map(([name, tier, use, scores], j) => {
    const y = header + j * row;
    return `<g transform="translate(0 ${y})"><title>${escape(name)} — ${axes.map((a, k) => a + ' ' + scores[k]).join(', ')}</title>
      ${rect(19, 0, column - 38, 1, '#354250')}
      ${label(19, 48, tier.toUpperCase(), 12, accent, 'letter-spacing="1.4" font-weight="bold"')}
      ${label(19, 80, name, 23, '#f1f4f8', 'font-weight="bold"')}
      ${label(19, 108, use, 14, '#bdc7d2')}
      <g transform="translate(356 80)">${radar(scores, accent)}</g></g>`;
  });
  return `<g transform="translate(${x} ${top})">
    ${rect(0, 0, column, header + models.length * row, '#19222c', 12)}
    ${rect(19, 20, 26, 3, accent, 1.5)}
    ${label(19, 61, provider, 30, '#f1f4f8', 'font-weight="bold"')}
    ${label(column - 20, 59, family, 17, accent, 'text-anchor="end"')}
    ${rows.join('')}</g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Inter, DejaVu Sans, sans-serif" role="img" aria-labelledby="title desc">
<title id="title">The AI model landscape</title>
<desc id="desc">Illustrative model profiles based on the supplied concept image. Five-axis radar charts use a common scale from zero to five.</desc>
${rect(0, 0, width, height, '#10171e')}
${label(margin, 70, 'The AI model landscape', 48, '#f1f4f8', 'font-weight="bold" letter-spacing="-1.5"')}
${label(margin, 106, 'Illustrative model profiles  /  Five skills on a shared 0–5 scale', 18, '#b7c4d0')}
${axes.map((a, i) => label(margin + i * 184, 148, initials[i] + '   ·   ' + a, 15, '#e0e9ef')).join('')}
${providers.map(panel).join('')}
${label(margin, bottom + 40, 'Further out = higher score. For affordability, higher means cheaper.', 15, '#b7c4d0')}
${label(width - margin, bottom + 40, 'Concept data  /  Unverified ratings', 15, '#b7c4d0', 'text-anchor="end"')}
</svg>`;
writeFileSync(local('landscape.svg'), svg + '\n');
