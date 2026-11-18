import { readFileSync, writeFileSync } from 'node:fs';

const local = name => new URL(name, import.meta.url);
const catalog = JSON.parse(readFileSync(local('models.json'), 'utf8'));
const benchmarks = JSON.parse(readFileSync(local('benchmarks.json'), 'utf8'));
const aa = new Map(benchmarks.artificialAnalysis.rows.map(result => [result.model, result]));
const metricByModel = new Map();
for (const result of benchmarks.terminalBench40.rows) {
  if (!metricByModel.has(result.model)) {
    metricByModel.set(result.model, `Terminal-Bench 4.0 · ${result.accuracy}`);
  }
}
for (const result of benchmarks.frontierCodeAA20.percent) {
  if (!metricByModel.has(result.model)) metricByModel.set(result.model, `FrontierCode 2.0 · ${result.score}%`);
}
for (const result of benchmarks.arenaVision.ranks) {
  if (!metricByModel.has(result.model)) metricByModel.set(result.model, `Arena Vision · rank ${result.rank}`);
}
const axes = ['Reasoning', 'Coding', 'Speed', 'Multimodal', 'Affordability'];
const versionOrder = new Intl.Collator('en', { numeric: true });
function selectVersions(models) {
  const lines = new Map();
  for (const model of models) {
    const line = model.name.replace(/-?\d+(?:\.\d+)*/u, '').trim().replace(/\s+/g, ' ');
    const current = lines.get(line);
    if (!lines.has(line)) lines.set(line, null);
    if (!Array.isArray(model.scores) || model.scores.length !== axes.length ||
        !model.scores.every(n => Number.isFinite(n) && n >= 0 && n <= 5)) continue;
    if (!current || versionOrder.compare(model.name, current.name) > 0) {
      lines.set(line, model);
    }
  }
  return [...lines.values()].filter(Boolean);
}
const providers = catalog.map(provider => ({ ...provider, models: selectVersions(provider.models) }));
const dates = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const axisColors = ['#ff9a9c', '#ffd06e', '#83e7ab', '#83c7ff', '#d5acff'];
const angles = axes.map((_, i) => i * 2 * Math.PI / axes.length - Math.PI / 2);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const label = (x, y, value, size, color = '#f1f4f8', extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escape(value)}</text>`;
const rect = (x, y, w, h, color, radius = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"/>`;

function radar(scores, accent) {
  const point = (i, r) => [Math.cos(angles[i]) * r, Math.sin(angles[i]) * r].map(v => v.toFixed(2));
  const polygon = (values, style) =>
    `<polygon points="${values.map((n, i) => point(i, 10 * n).join(',')).join(' ')}" ${style}/>`;
  const rings = [1, 2, 3, 4, 5].map(n => polygon(axes.map(() => n), 'fill="none" stroke="#354250"'));
  const spokes = axes.map((_, i) => `<path d="M0,0 L${point(i, 50)}" stroke="#354250"/>`);
  const letters = axes.map((axis, i) => {
    const [x, y] = point(i, 64);
    return label(x, Number(y) + 4, axis[0], 12, axisColors[i], 'text-anchor="middle" font-weight="bold"');
  });
  return [...rings, ...spokes, polygon(scores, `stroke="${accent}" stroke-width="2.5" fill="${accent}" fill-opacity=".24"`), ...letters].join('');
}

const margin = 44, column = 436, gap = 16, top = 64, header = 84, row = 154;
const width = 2 * margin + providers.length * column + (providers.length - 1) * gap;
const bottom = top + header + row * Math.max(...providers.map(p => p.models.length));
const height = bottom + 40;
function panel({ provider, family, accent, models, releaseSource }, i) {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('Expected a hex accent color.');
  const x = margin + i * (column + gap);
  const rows = models.map(({ name, use, scores, releaseDate }, j) => {
    const y = header + j * row;
    const result = aa.get(name);
    const metrics = result ? `AA ${result.index}   ·   $${result.costUsdPerTask.toFixed(2)}/task   ·   ${result.minutesPerTask} min/task` : metricByModel.get(name);
    return `<g transform="translate(0 ${y})"><title>${escape(name)} — ${result ? escape('Artificial Analysis · ' + result.effort) : escape(use)}</title>
      ${rect(19, 0, column - 38, 1, '#354250')}
      ${label(19, 42, name, 23, '#f1f4f8', 'font-weight="bold"')}
      <a href="${escape(releaseSource)}">${label(19, 66, 'Released ' + dates.format(new Date(releaseDate)), 14, '#bdc7d2')}</a>
      <g fill="${accent}">
        <rect x="19" y="76" width="264" height="27" rx="4" fill-opacity=".09"/>
        <rect x="19" y="80" width="3" height="19" rx="1.5"/>
        ${label(30, 95, use, 15, '#f1f4f8', 'font-weight="500"')}
      </g>
      ${metrics ? label(19, 119, metrics, 14) : ''}
      ${scores ? `<g transform="translate(356 80)">${radar(scores, accent)}</g>` : ''}</g>`;
  });
  return `<g transform="translate(${x} ${top})">
    ${rect(0, 0, column, header + models.length * row, '#19222c', 12)}
    ${rect(19, 20, 26, 3, accent, 1.5)}
    ${label(19, 61, provider, 30, '#f1f4f8', 'font-weight="bold"')}
    ${label(column - 20, 59, family, 17, accent, 'text-anchor="end"')}
    ${rows.join('')}</g>`;
}

const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Inter, DejaVu Sans, sans-serif" role="img" aria-labelledby="title desc">
<title id="title">The AI model landscape</title>
<desc id="desc">Illustrative model profiles based on the supplied concept image. Five-axis radar charts use a common scale from zero to five.</desc>
${rect(0, 0, width, height, '#10171e')}
${axes.map((a, i) => label(margin + i * 184, top - 26, a[0] + '   ·   ' + a, 15, axisColors[i])).join('')}
${providers.map(panel).join('')}
${label(width - margin, bottom + 26, `Generated ${generatedAt} UTC`, 12, '#8895a3', 'text-anchor="end"')}
</svg>`;
writeFileSync(local('landscape.svg'), svg.replace(/^ +$/gm, '') + '\n');
