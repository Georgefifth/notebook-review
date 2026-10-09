export const MAX_BYTES = 5 * 1024 * 1024;
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function textValue(value, label = '文本') {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value.join('');
  throw new Error(label + '必须是字符串或字符串列表。');
}
export function normalize(nb) {
  if (!nb || nb.nbformat !== 4 || !Array.isArray(nb.cells) || nb.cells.length > 10000) throw new Error('请导入有效的 Notebook v4 文件（最多 10,000 个单元格）。');
  const ids = new Set();
  return nb.cells.map((cell, index) => {
    if (!cell || !['code', 'markdown', 'raw'].includes(cell.cell_type)) throw new Error('单元格类型不受支持。');
    const id = cell.id ?? null;
    if (id !== null && (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || ids.has(id))) throw new Error('Notebook 的单元格 ID 无效或重复。');
    if (id !== null) ids.add(id);
    if (cell.cell_type === 'code' && !Array.isArray(cell.outputs)) throw new Error('代码单元格缺少有效的 outputs 列表。');
    const outputs = (cell.outputs || []).map(output => {
      if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('输出格式无效。');
      const clean = { ...output };
      delete clean.execution_count;
      if (clean.output_type === 'stream') clean.text = textValue(clean.text, '文本输出');
      if (clean.data && typeof clean.data === 'object') {
        clean.data = { ...clean.data };
        for (const mime of ['text/plain', 'text/html', 'image/png', 'image/jpeg', 'image/svg+xml']) {
          if (clean.data[mime] !== undefined) clean.data[mime] = textValue(clean.data[mime], '输出内容');
        }
      }
      return clean;
    });
    return { id, key: id === null ? 'legacy:' + index : 'id:' + id, type: cell.cell_type, source: textValue(cell.source, '单元格内容'), outputs, attachments: cell.attachments || {} };
  });
}
export async function snapshot(nb) {
  const cells = normalize(nb);
  if (!globalThis.crypto?.subtle) throw new Error('浏览器缺少 Web Crypto，请使用新版 Chrome、Firefox 或 Edge，或通过本机 localhost 打开。');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(cells)));
  const id = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return { id, cells };
}
export function compare(base, revision) {
  const matched = new Set();
  const revisionIds = new Map(revision.cells.map((c, i) => [c.id, i]).filter(([id]) => id !== null));
  const reserved = new Set(base.cells.filter(c => c.id !== null).map(c => revisionIds.get(c.id)).filter(i => i !== undefined));
  const signature = cell => canonical([cell.type, cell.source]);
  const frequency = cells => {
    const result = new Map();
    for (const cell of cells) result.set(signature(cell), (result.get(signature(cell)) || 0) + 1);
    return result;
  };
  const bf = frequency(base.cells), rf = frequency(revision.cells);
  const uniqueSources = new Map();
  revision.cells.forEach((c, i) => { if (rf.get(signature(c)) === 1) uniqueSources.set(signature(c), i); });
  const rows = base.cells.map((cell, index) => {
    let next = cell.id === null ? -1 : (revisionIds.get(cell.id) ?? -1);
    let method = next >= 0 ? 'id' : null;
    if (next < 0 && bf.get(signature(cell)) === 1 && rf.get(signature(cell)) === 1) {
      const candidate = uniqueSources.get(signature(cell));
      next = candidate !== undefined && !reserved.has(candidate) && (cell.id === null || revision.cells[candidate].id === null) ? candidate : -1;
      if (next >= 0) method = 'unique-source';
    }
    if (next >= 0 && matched.has(next)) { next = -1; method = null; }
    if (next < 0) return { baseIndex: index, revisionIndex: null, key: cell.key, status: cell.id === null ? 'unlinked' : 'removed', method, sourceChanged: false, outputChanged: false, moved: false };
    matched.add(next);
    const newer = revision.cells[next];
    const sourceChanged = cell.type !== newer.type || cell.source !== newer.source;
    const outputChanged = canonical(cell.outputs) !== canonical(newer.outputs) || canonical(cell.attachments) !== canonical(newer.attachments);
    return { baseIndex: index, revisionIndex: next, key: cell.key, status: sourceChanged || outputChanged ? 'changed' : 'unchanged', method, sourceChanged, outputChanged, moved: next !== index };
  });
  return { rows, added: revision.cells.map((_, i) => i).filter(i => !matched.has(i)) };
}
export function validateComments(comments, base) {
  if (!Array.isArray(comments) || comments.length > 10000) throw new Error('反馈数量无效。');
  const keys = new Set(base.cells.map(c => c.key)), ids = new Set();
  return comments.map(c => {
    if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(c.id) || ids.has(c.id)) throw new Error('反馈 ID 无效或重复。');
    if (c.snapshotId !== base.id || !keys.has(c.cellKey)) throw new Error('反馈不属于这份审阅快照或单元格。');
    if (typeof c.body !== 'string' || !c.body.trim() || c.body.length > 10000 || typeof c.author !== 'string' || c.author.length > 100 || typeof c.resolved !== 'boolean' || typeof c.createdAt !== 'string' || !Number.isFinite(Date.parse(c.createdAt))) throw new Error('反馈内容或作者格式无效。');
    if (c.reviewedRevisionId != null && !/^[a-f0-9]{64}$/.test(c.reviewedRevisionId)) throw new Error('复核版本标识无效。');
    ids.add(c.id);
    return { id: c.id, snapshotId: c.snapshotId, cellKey: c.cellKey, body: c.body, author: c.author, resolved: c.resolved, reviewedRevisionId: c.reviewedRevisionId || null, createdAt: c.createdAt };
  });
}
