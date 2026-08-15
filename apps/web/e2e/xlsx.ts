/**
 * Fabrique un classeur `.xlsx` minimal, sans aucune dépendance.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce fichier existe plutôt qu'un `import` de bibliothèque.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le parcours d'import des représentants ne prouve quelque chose qu'en
 * DÉPOSANT un vrai classeur : c'est un envoi multipart, relayé par
 * `/api/v1/*`, relu par ExcelJS côté API. Or `@crm/web` n'embarque aucune
 * bibliothèque de tableur, et lui en ajouter une pour les seuls tests ferait
 * peser une dépendance de plus sur le paquet livré.
 *
 * Deux fausses pistes ont été écartées avant d'en arriver là :
 *
 *  - **Redéposer le modèle téléchargé.** Le lecteur commence à la ligne 3
 *    (`FIRST_DATA_ROW`), et la ligne 2 du modèle est un EXEMPLE grisé : le
 *    classeur pristine ne porte donc aucune ligne de données. La simulation
 *    rendrait « 0 ligne lue » et le bouton d'application resterait inerte.
 *  - **Un fichier figé rangé dans `e2e/`.** Le téléphone est la clé de
 *    déduplication : la deuxième exécution ne verrait que des doublons, et
 *    l'étape d'application, celle qui écrit vraiment, ne serait jamais
 *    éprouvée deux fois de suite.
 *
 * Fabriquer le classeur à l'exécution règle les deux : le numéro est unique à
 * chaque passage, et l'application est réellement jouée à chaque exécution.
 *
 * Le format produit est volontairement pauvre : archive ZIP en méthode
 * « stockée », chaînes en clair dans la feuille (`inlineStr`), ni styles, ni
 * table de chaînes partagées. C'est le sous-ensemble strictement nécessaire
 * pour qu'ExcelJS relise les cellules, et il a été éprouvé contre la version
 * d'ExcelJS que l'API utilise.
 */

/** Table CRC-32 (polynôme inversé 0xEDB88320), calculée une fois. */
const CRC_TABLE: Int32Array = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = -1;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/**
 * La feuille, en chaînes littérales.
 *
 * `xml:space="preserve"` n'est pas une précaution de style : sans lui, un
 * téléphone saisi « 77 900 12 34 » perdrait ses espaces au passage, et le
 * classeur ne testerait plus la normalisation faite par le serveur.
 */
function sheetXml(rows: readonly (readonly string[])[]): string {
  const body = rows
    .map((cells, rowIndex) => {
      const line = rowIndex + 1;
      const painted = cells
        .map((cell, columnIndex) => {
          // Une cellule vide n'est pas écrite : c'est ainsi qu'un tableur la
          // rend, et le lecteur de l'API la relit alors comme absente.
          if (cell === '') return '';
          // Colonnes A à Z : le modèle d'import en compte cinq, et ce
          // fabricant n'a pas vocation à servir au-delà.
          const reference = `${String.fromCharCode(65 + columnIndex)}${String(line)}`;
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${String(line)}">${painted}</row>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${body}</sheetData>` +
    '</worksheet>'
  );
}

interface ZipEntry {
  readonly name: string;
  readonly content: string;
}

/**
 * Archive ZIP en méthode « stockée » (aucune compression).
 *
 * Compresser n'apporterait rien sur cinq lignes, et imposerait de dupliquer la
 * taille avant et après déflation dans deux en-têtes. Stocker rend le format
 * relisible à l'œil quand quelque chose cloche.
 */
function zip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.content, 'utf8');
    const sum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    // Bit 11 : les noms d'entrée sont en UTF-8. Les libellés du modèle portent
    // des accents, et sans ce drapeau ils seraient lus en CP437.
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(sum, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);

    locals.push(local, name, data);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, directory, end]);
}

/** Un classeur d'une seule feuille, ses lignes dans l'ordre donné. */
export function buildXlsx(sheetName: string, rows: readonly (readonly string[])[]): Buffer {
  return zip([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(rows) },
  ]);
}
