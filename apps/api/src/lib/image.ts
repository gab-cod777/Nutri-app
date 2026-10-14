export type PhotoMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Detecta o tipo real da imagem pelos magic bytes.
 *
 * Nao confiamos na extensao nem no Content-Type do upload: um arquivo
 * qualquer renomeado para .jpg nao pode chegar ao servico de IA.
 */
export function sniffImageType(bytes: Uint8Array): PhotoMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) {
    return 'image/png';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}
