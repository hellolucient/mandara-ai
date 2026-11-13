export function chunkText(text: string, size = 900, overlap = 120): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const piece = paragraph.trim();
    if (!piece) continue;
    if (piece.length > size) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < piece.length; index += size - overlap) {
        chunks.push(piece.slice(index, index + size));
      }
      continue;
    }
    if (`${current}\n\n${piece}`.trim().length > size) {
      chunks.push(current);
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = `${tail}\n\n${piece}`.trim();
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 200);
}
