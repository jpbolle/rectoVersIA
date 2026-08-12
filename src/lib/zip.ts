// Mini-générateur d'archive ZIP (méthode STORE, sans compression) — écrit à la
// main pour éviter une dépendance. Suffisant pour des fichiers HTML/CSV légers
// (l'archive d'une classe avant suppression).
// Format : en-têtes locaux + répertoire central + End Of Central Directory.

export interface ZipEntry {
  path: string;              // chemin dans l'archive (séparateur /)
  content: Buffer | string;  // contenu (les chaînes sont encodées en UTF-8)
}

// CRC-32 (table standard, polynôme 0xEDB88320)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Date/heure au format MS-DOS (champs time et date des en-têtes ZIP)
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function buildZip(entries: ZipEntry[], now: Date = new Date()): Buffer {
  const { time, date } = dosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, 'utf8');
    const dataBuf = typeof entry.content === 'string'
      ? Buffer.from(entry.content, 'utf8')
      : entry.content;
    const crc = crc32(dataBuf);

    // En-tête local (30 octets + nom) puis données
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // signature
    local.writeUInt16LE(20, 4);           // version requise
    local.writeUInt16LE(0x0800, 6);       // flags : noms en UTF-8
    local.writeUInt16LE(0, 8);            // méthode STORE
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18); // taille compressée = brute (STORE)
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra vide
    localParts.push(local, nameBuf, dataBuf);

    // Entrée du répertoire central (46 octets + nom)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);         // version créateur
    central.writeUInt16LE(20, 6);         // version requise
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // commentaires / extra / disque / attributs : zéro
    central.writeUInt32LE(offset, 42);    // offset de l'en-tête local
    centralParts.push(central, nameBuf);

    offset += 30 + nameBuf.length + dataBuf.length;
  }

  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);

  // End Of Central Directory (22 octets)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}
