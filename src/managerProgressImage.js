import { PROGRESS_LABELS, PROGRESS_NOTE, RANK_NOTE, TIER_NOTE, progressMetricText, progressRowStatus } from './managerProgress.js';
import { displayStoreName } from './uiDefinitions.js';

export async function createManagerProgressImage(report) {
  await document.fonts.ready;
  const width = 390;
  const cardHeight = 182;
  const height = 143 + report.rows.reduce((sum, row) => sum + (row.excluded ? 55 : cardHeight), 0);
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(scale, scale);
  const text = (value, x, y, size, color = '#172b48', weight = 500, maxWidth = width - x - 16) => {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, maxWidth);
  };
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(0, 0, width, height, '#eff4fc');
  rect(0, 0, width, 129, '#133b76');
  text('미소모바일  |  2026년 11월', 16, 24, 12, '#c6dafc', 700);
  text('점장정책 중간 진척도', 16, 52, 23, '#ffffff', 800);
  text(`회사입력 기준 · 순위 기준일 ${report.rankDate ?? '확인 대기'}`, 16, 72, 12, '#ffffff');
  [PROGRESS_NOTE, RANK_NOTE, TIER_NOTE].forEach((note, index) => text(note, 16, 90 + index * 14, 10, '#e0ecff'));
  let y = 138;
  for (const row of report.rows) {
    rect(10, y, 370, row.excluded ? 47 : cardHeight - 8, '#ffffff');
    text(displayStoreName(row.store), 20, y + 21, 15, '#172b48', 800);
    text(progressRowStatus(row, report.rankDate), 20, y + 37, 10, '#516580');
    if (!row.excluded) {
      Object.entries(PROGRESS_LABELS).forEach(([key, label], index) => {
        const x = 20 + (index % 2) * 179;
        const top = y + 44 + Math.floor(index / 2) * 63;
        const metric = progressMetricText(row.progress[key]);
        rect(x, top, 170, 57, '#f4f7fc');
        text(label, x + 7, top + 14, 10, '#516580', 700);
        text(metric.score, x + 7, top + 32, 15, '#164b9b', 800, 88);
        text(metric.counts, x + 96, top + 31, 10, '#172b48', 600, 68);
        text(metric.tier, x + 7, top + 48, 10, '#516580', 500, 156);
      });
    }
    y += row.excluded ? 55 : cardHeight;
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG unavailable');
  return new File([blob], '미소모바일_2026-11_점장정책_진척도.png', { type: 'image/png' });
}
