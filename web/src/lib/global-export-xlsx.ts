import type { Worksheet } from 'exceljs';

export async function completeGlobalWorkbook(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const [excel, { default: Chart }] = await Promise.all([
    import('exceljs'),
    import('chart.js/auto'),
  ]);
  const workbook = new excel.Workbook();
  await workbook.xlsx.load(buffer);
  const dashboard = workbook.getWorksheet('Tableau de bord');
  if (!dashboard) throw new Error('Le fichier reçu est incomplet. Réessayez.');
  const groups = chartGroups(dashboard);
  let top = 1;
  for (const [title, points] of groups) {
    const canvas = document.createElement('canvas');
    canvas.width = 1_100;
    const timeline = title === 'Appels par mois';
    canvas.height = timeline ? 450 : Math.max(360, points.length * 32 + 100);
    const chart = new Chart(canvas, {
      type: timeline ? 'line' : 'bar',
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            data: points.map((point) => point.value),
            backgroundColor: '#537994',
            borderColor: '#537994',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: 2,
        indexAxis: timeline ? 'x' : 'y',
        font: { family: 'Arial', size: 19 },
        color: '#222222',
        plugins: {
          legend: { display: false },
          title: { display: true, text: title, font: { family: 'Arial', size: 19 } },
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { family: 'Arial', size: 19 }, precision: 0 } },
          y: { beginAtZero: true, ticks: { font: { family: 'Arial', size: 19 }, precision: 0 } },
        },
      },
    });
    try {
      const height = chart.height;
      const image = workbook.addImage({ base64: chart.toBase64Image(), extension: 'png' });
      dashboard.addImage(image, {
        tl: { col: 4, row: top },
        ext: { width: 1_100, height },
        editAs: 'absolute',
      });
      top += Math.ceil(height / 32) + 2;
    } finally {
      chart.destroy();
    }
  }
  return workbook.xlsx.writeBuffer();
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
