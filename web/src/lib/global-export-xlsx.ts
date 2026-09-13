import type { Worksheet } from 'exceljs';

export async function completeGlobalWorkbook(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const excel = await import('exceljs');
  const workbook = new excel.Workbook();
  await workbook.xlsx.load(buffer);
  const dashboard = workbook.getWorksheet('Tableau de bord');
  if (!dashboard) throw new Error('Le fichier reçu est incomplet. Réessayez.');
  const groups = chartGroups(dashboard);
  let top = 1;
  for (const [title, points] of groups) {
    const timeline = title === 'Appels par mois';
    const width = 1_100;
    const height = timeline ? 450 : Math.max(360, points.length * 32 + 100);
    const image = workbook.addImage({
      base64: await exportChartPng(title, points, timeline, width, height),
      extension: 'png',
    });
    dashboard.addImage(image, {
      tl: { col: 4, row: top },
      ext: { width, height },
      editAs: 'absolute',
    });
    top += Math.ceil(height / 32) + 2;
  }
  return workbook.xlsx.writeBuffer();
}

async function exportChartPng(
  title: string,
  points: readonly { label: string; value: number }[],
  timeline: boolean,
  width: number,
  height: number,
): Promise<string> {
  const max = Math.max(1, ...points.map((point) => point.value));
  const left = timeline ? 72 : 300;
  const bottom = 58;
  const innerWidth = width - left - 32;
  const innerHeight = height - 92;
  const bars = points
    .map((point, index) => {
      const slot = innerWidth / Math.max(points.length, 1);
      const barWidth = timeline ? 5 : Math.max(10, slot * 0.62);
      const barHeight = (point.value / max) * innerHeight;
      const x = timeline ? left + index * slot + slot / 2 - barWidth / 2 : left;
      const y = height - bottom - barHeight;
      return `<rect x="${String(x)}" y="${String(y)}" width="${String(barWidth)}" height="${String(barHeight)}" rx="6" fill="#0f766e"/>`;
    })
    .join('');
  const labels = points
    .map((point, index) => {
      const slot = innerWidth / Math.max(points.length, 1);
      const x = timeline ? left + index * slot + slot / 2 : left - 14;
      const y = timeline
        ? height - 25
        : height - bottom - (index + 0.5) * (innerHeight / Math.max(points.length, 1));
      return `<text x="${String(x)}" y="${String(y)}" text-anchor="${timeline ? 'middle' : 'end'}" font-family="Arial" font-size="18" fill="#334155">${escapeXml(point.label)}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}"><rect width="100%" height="100%" fill="white"/><text x="32" y="38" font-family="Arial" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>${bars}${labels}</svg>`;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Le navigateur ne peut pas préparer l’image du graphique.');
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Le graphique exporté est illisible.'));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character] ?? character);
}

function chartGroups(sheet: Worksheet): Map<string, { label: string; value: number }[]> {
  const groups = new Map<string, { label: string; value: number }[]>();
  const selected = new Set([
    'Parcours par statut',
    'Prospects par téléconseiller',
    'Prospects par segment',
    'Appels par mois',
  ]);
  sheet.eachRow((row) => {
    const group = row.getCell(1).text;
    const value = row.getCell(3).value;
    if (!selected.has(group) || typeof value !== 'number') return;
    const points = groups.get(group) ?? [];
    points.push({ label: row.getCell(2).text, value });
    groups.set(group, points);
  });
  return groups;
}
