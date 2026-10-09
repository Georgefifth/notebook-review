import { MAX_BYTES, snapshot, compare, validateComments } from './core.mjs';
import { ReviewAPI, query } from './service.mjs';
const $ = id => document.getElementById(id);
const state = { project: null, base: null, revision: null, comments: [], selected: null, filter: 'all', demo: false, api: null, busy: false };
let config = null, pollBusy = false, lastPollError = '', otpEmail = null;
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
function notice(message, error = false) { $('notice').textContent = message; $('notice').className = 'notice' + (error ? ' error' : ''); $('notice').hidden = !message; }
async function action(fn) { try { await fn(); } catch (error) { notice(['TimeoutError', 'AbortError'].includes(error.name) ? '网络请求超时，请重试。' : error.message || '操作未完成。', true); } }
function canLeave() { if (!$('comment-body').value.trim()) return true; return confirm('这条反馈尚未发送。放弃草稿并继续？'); }
function resetSelection() { state.selected = null; $('comment-body').value = ''; }
function actor() { return state.demo ? '示例审阅者' : state.api?.session?.user?.email || '本地审阅者'; }
function owner() { return state.demo || !state.project?.id || state.api?.session?.user?.id === state.project.owner_id; }
function authUI() {
  const session = state.api?.session;
  $('identity').textContent = session?.user?.email || ''; $('identity').hidden = !session;
  $('logout').hidden = !session; $('login-open').hidden = !!session;
  $('mode').textContent = !config ? '本地演示 · 未连接服务' : session ? '在线工作区' : '邮箱登录后共享';
  if (!session && state.project?.id) { state.project = null; state.base = null; state.comments = []; state.revision = null; resetSelection(); render(); $('project-list').replaceChildren(); }
}
function openLogin() { if (!config) { notice('尚未配置在线服务。可体验示例和本地审阅；在线共享需要部署配置。', true); return; } $('login-dialog').showModal(); $('email').focus(); }
async function readNotebook(file) { if (!file || file.size > MAX_BYTES) throw new Error('请选择不超过 5 MB 的 .ipynb 文件。'); let notebook; try { notebook = JSON.parse(await file.text()); } catch { throw new Error('文件不是有效的 JSON Notebook。'); } await snapshot(notebook); return notebook; }
function localStoreKey() { return 'nr-comments:' + state.base.id; }
function saveLocal() { try { localStorage.setItem(localStoreKey(), JSON.stringify(state.comments)); return true; } catch { notice('浏览器无法保存本地反馈。请使用“导出反馈”保存。', true); return false; } }
async function openLocal(notebook, title, demo = false) {
  const base = await snapshot(notebook);
  let comments = [];
  try { const saved = JSON.parse(localStorage.getItem('nr-comments:' + base.id) || '[]'); comments = validateComments(saved, base); } catch { notice('本地反馈缓存不可用，将使用新审阅。', true); }
  state.project = { title, base_notebook: notebook, snapshot_id: base.id }; state.base = base; state.revision = null; state.comments = comments; state.demo = demo; state.filter = 'all'; resetSelection(); render();
  notice(demo ? '这是合成示例，评论仅保存在本浏览器。点击“共享为在线审阅”可创建在线审阅。' : '已在本地打开；点击“共享为在线审阅”后才会上传并创建在线审阅。');
}
async function listProjects() {
  if (!state.api?.session) return;
  const projects = await state.api.request('review_projects', query({ select: 'id,title,owner_id,created_at', order: 'created_at.desc' }));
  const list = $('project-list'); list.replaceChildren();
  if (!projects.length) list.append(el('p', '还没有在线审阅。导入 Notebook，或打开示例后共享。', 'empty'));
  for (const project of projects) { const button = el('button', project.title, 'project-item' + (state.project?.id === project.id ? ' active' : '')); button.append(el('small', project.owner_id === state.api.session.user.id ? '由你发起' : '受邀审阅')); button.onclick = () => action(async () => { if (canLeave()) await loadProject(project.id); }); list.append(button); }
}
async function loadProject(id) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('审阅链接无效。');
  const projects = await state.api.request('review_projects', query({ id: 'eq.' + id, select: '*' }));
  if (!projects.length) throw new Error('无法访问这份审阅。请确认使用受邀邮箱登录，或请发起者添加你的邮箱。');
  const project = projects[0], base = await snapshot(project.base_notebook);
  if (base.id !== project.snapshot_id) throw new Error('项目快照校验失败，已停止加载。');
  const revision = project.revision_notebook ? await snapshot(project.revision_notebook) : null;
  const comments = await state.api.request('review_comments', query({ project_id: 'eq.' + id, order: 'created_at.asc' }));
  state.project = project; state.base = base; state.revision = revision; state.comments = comments; state.demo = false; state.filter = 'all'; resetSelection();
  history.replaceState(null, '', '?project=' + id); render(); await listProjects(); notice('审阅已同步。');
}
async function createOnlineProject() {
  if (!config) { openLogin(); return false; }
  if (!state.api?.session) { openLogin(); return false; }
  const local = state.project;
  const rows = await state.api.request('review_projects', '', 'POST', { title: local.title.slice(0, 160), owner_id: state.api.session.user.id, base_notebook: local.base_notebook, snapshot_id: state.base.id, revision_notebook: local.revision_notebook || null });
  if (!rows[0]?.id) throw new Error('创建审阅没有返回项目 ID。');
  // Local comments are not silently attributed to an authenticated account.
  await loadProject(rows[0].id);
  notice('在线审阅已创建。本地演示反馈未上传；在线评论会记录登录邮箱。');
  return true;
}
function renderMarkdown(container, source) {
  for (const block of source.split(/\n\s*\n/)) {
    const heading = block.match(/^(#{1,3})\s+([^\n]+)(?:\n([\s\S]*))?$/);
    if (heading) { container.append(el(heading[1].length === 1 ? 'h2' : 'h3', heading[2])); if (heading[3]) container.append(el('p', heading[3])); }
    else container.append(el('p', block));
  }
}
function renderContent(container, cell) {
  if (cell.type === 'markdown') { renderMarkdown(container, cell.source); if (Object.keys(cell.attachments).length) container.append(el('small', '附件未渲染，请在原始 Notebook 中核对。')); }
  else container.append(el('pre', cell.source, 'code'));
  if (!cell.outputs.length) return;
  const output = el('div', undefined, 'output'); output.append(el('span', '已保存的输出', 'output-label'));
  for (const item of cell.outputs) {
    if (item.output_type === 'stream') { try { output.append(el('pre', textValueUI(item.text))); } catch { output.append(el('small', '文本输出格式不受支持。')); } continue; }
    if (item.output_type === 'error') { output.append(el('pre', [item.ename, item.evalue].filter(Boolean).join(': '), 'traceback')); continue; }
    const data = item.data || {}; let displayed = false;
    for (const mime of ['image/png', 'image/jpeg']) {
      if (!data[mime]) continue;
      const encoded = Array.isArray(data[mime]) ? data[mime].join('') : data[mime];
      if (typeof encoded === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(encoded) && encoded.length <= MAX_BYTES) { const img = el('img'); img.src = 'data:' + mime + ';base64,' + encoded.replace(/\s/g, ''); img.alt = 'Notebook 已保存的图像输出'; output.append(img); displayed = true; break; }
    }
    if (!displayed && data['text/plain']) { output.append(el('pre', textValueUI(data['text/plain']))); displayed = true; }
    if (!displayed) output.append(el('small', '此输出暂不支持安全预览（HTML、SVG 或交互组件）。请在原始 Notebook 中核对。'));
  }
  container.append(output);
}
function textValueUI(value) { return typeof value === 'string' ? value : Array.isArray(value) ? value.filter(v => typeof v === 'string').join('') : ''; }
function rowFor(key) { return state.revision ? compare(state.base, state.revision).rows.find(row => row.key === key) : null; }
function needsRecheck(comment) { const row = rowFor(comment.cell_key || comment.cellKey); return comment.resolved && row && (row.status !== 'unchanged'); }
function isOpen(comment) { return !comment.resolved || needsRecheck(comment); }
function commentsFor(key) { return state.comments.filter(c => (c.cell_key || c.cellKey) === key); }
function appendBadge(node, text, warning = false) { node.append(el('span', text, 'badge' + (warning ? ' warn' : ''))); }
function cellCard(cell, index, row, added = false) {
  const card = el('article', undefined, 'cell' + (state.selected === cell.key && !added ? ' selected' : '') + (row?.status === 'changed' ? ' changed' : '')); card.id = (added ? 'added-' : 'cell-') + index;
  const head = el('div', undefined, 'cell-head'), title = el('span', '单元格 ' + (index + 1) + ' · ' + ({ markdown: '说明', code: '代码', raw: '原始文本' }[cell.type])); head.append(title);
  if (row) {
    if (row.sourceChanged) appendBadge(title, '内容修改', true);
    if (row.outputChanged) appendBadge(title, '输出变化', true);
    if (row.moved) appendBadge(title, '位置变化');
    if (row.status === 'removed') appendBadge(title, '新版已删除', true);
    if (row.status === 'unlinked') appendBadge(title, '无法确认对应', true);
    if (row.method === 'unique-source') appendBadge(title, '按唯一内容对应');
  }
  if (!added) { const comments = commentsFor(cell.key); const button = el('button', '讨论' + (comments.length ? ' · ' + comments.length : '')); button.onclick = () => { if (state.selected !== cell.key && $('comment-body').value.trim()) { notice('请先发送或清空当前草稿，再切换单元格。', true); $('draft-note').hidden = false; return; } state.selected = cell.key; renderCells(); renderDiscussion(); $('comment-body').focus(); }; head.append(button); }
  card.append(head);
  if (row && row.status === 'changed' && row.revisionIndex !== null) { const wrap = el('div', undefined, 'comparison'); for (const [label, content] of [['审阅时的快照', cell], ['新版 · 单元格 ' + (row.revisionIndex + 1), state.revision.cells[row.revisionIndex]]]) { const pane = el('div', undefined, 'cell-body'); pane.append(el('span', label, 'pane-label')); renderContent(pane, content); wrap.append(pane); } card.append(wrap); }
  else { const body = el('div', undefined, 'cell-body'); renderContent(body, cell); card.append(body); }
  return card;
}
function renderCells() {
  const list = $('cell-list'); list.replaceChildren(); if (!state.base) return;
  const comparison = state.revision ? compare(state.base, state.revision) : null;
  state.base.cells.forEach((cell, index) => { const row = comparison?.rows[index]; if (state.filter === 'open' && !commentsFor(cell.key).some(isOpen)) return; if (state.filter === 'changed' && (!row || row.status === 'unchanged' && !row.moved)) return; list.append(cellCard(cell, index, row)); });
  if (!list.childElementCount) list.append(el('p', state.filter === 'changed' && !state.revision ? '加载新版 Notebook 后，这里会显示变化。' : '没有符合条件的单元格。', 'empty'));
  $('added-section').hidden = !comparison?.added.length || state.filter === 'open'; $('added-list').replaceChildren();
  if (comparison) for (const index of comparison.added) $('added-list').append(cellCard(state.revision.cells[index], index, null, true));
}
function renderDiscussion() {
  const cell = state.base?.cells.find(c => c.key === state.selected), list = $('comments'); list.replaceChildren();
  $('comment-form').hidden = !cell; $('discussion-title').textContent = cell ? '单元格 ' + (state.base.cells.indexOf(cell) + 1) : '选择一个单元格'; $('discussion-context').textContent = cell ? '反馈绑定审阅时的快照。' : '点击“讨论”，在对应内容旁留下反馈。';
  $('comment-author').textContent = actor(); $('draft-note').hidden = true;
  if (!cell) return;
  const comments = commentsFor(cell.key);
  if (!comments.length) list.append(el('p', '还没有反馈。可以从一个具体问题开始。', 'empty'));
  for (const comment of comments) {
    const card = el('div', undefined, 'comment' + (comment.resolved ? ' resolved' : '')); const meta = el('div', undefined, 'comment-meta'); meta.append(el('span', comment.author_email || comment.author), el('time', new Date(comment.created_at || comment.createdAt).toLocaleDateString('zh-CN'))); card.append(meta, el('p', comment.body));
    if (needsRecheck(comment)) appendBadge(card, '原反馈已关闭 · 新版需复核', true);
    else if (comment.resolved) appendBadge(card, '已关闭');
    const editable = !state.project.id || owner() || comment.author_id === state.api?.session?.user?.id;
    if (editable) { const button = el('button', comment.resolved ? '重新打开' : '标记已处理'); button.onclick = () => action(async () => {
      if (state.project.id) { const rows = await state.api.request('review_comments', query({ id: 'eq.' + comment.id, version: 'eq.' + comment.version }), 'PATCH', { resolved: !comment.resolved }); if (!rows.length) throw new Error('这条反馈已被其他人更新，请刷新后再操作。'); await syncComments(); }
      else { comment.resolved = !comment.resolved; saveLocal(); renderCells(); renderDiscussion(); updateSummary(); }
    }); card.append(button); }
    list.append(card);
  }
}
function updateSummary() { const open = state.comments.filter(isOpen).length; $('summary').textContent = state.base.cells.length + ' 个单元格 · ' + open + ' 条待处理反馈'; }
function render() {
  const ready = !!state.base; $('welcome').hidden = ready; $('workspace').hidden = !ready; if (!ready) { renderDiscussion(); return; }
  $('project-title').textContent = state.project.title; $('project-context').textContent = state.project.id ? '共享审阅 · ' + (owner() ? '由你发起' : '受邀参与') : state.demo ? '示例审阅 · 仅本地' : '本地预览 · 尚未共享';
  $('project-subtitle').textContent = '审阅快照 ' + state.base.id.slice(0, 12) + (state.revision ? ' · 正在对照新版' : ' · 原始文件保持不变');
  $('share').hidden = !owner(); $('share').textContent = state.project.id ? '邀请合作者' : '共享为在线审阅'; $('revision-button').hidden = !owner(); $('refresh-review').hidden = !state.project.id;
  $('comparison-note').hidden = !state.revision;
  for (const filter of ['all', 'open', 'changed']) $('filter-' + filter).classList.toggle('active', state.filter === filter);
  updateSummary(); renderCells(); renderDiscussion();
}
async function syncComments() {
  const projectId = state.project?.id; if (!projectId || !state.api?.session) return;
  const comments = await state.api.request('review_comments', query({ project_id: 'eq.' + projectId, order: 'created_at.asc' }));
  if (state.project?.id !== projectId) return;
  if (JSON.stringify(comments) !== JSON.stringify(state.comments)) { state.comments = comments; renderCells(); renderDiscussion(); updateSummary(); }
}
async function showShare() {
  if (!state.project.id && !(await createOnlineProject())) return;
  $('share-dialog').showModal(); $('share-link').value = location.origin + '/?project=' + state.project.id; await refreshMembers();
}
async function refreshMembers() {
  const members = await state.api.request('review_members', query({ project_id: 'eq.' + state.project.id, order: 'invited_at.asc' })); $('members').replaceChildren();
  for (const member of members) { const row = el('div', undefined, 'member'); row.append(el('span', member.email)); const button = el('button', '移除访问'); button.onclick = () => action(async () => { await state.api.request('review_members', query({ project_id: 'eq.' + state.project.id, email: 'eq.' + member.email }), 'DELETE'); await refreshMembers(); $('share-message').textContent = '已撤销访问。对方已下载的副本无法收回。'; }); row.append(button); $('members').append(row); }
}
$('demo').onclick = $('welcome-demo').onclick = () => action(async () => { if (!canLeave()) return; const response = await fetch('/examples/base.ipynb'); await openLocal(await response.json(), '样本质量分析 · 合成示例', true); history.replaceState(null, '', '/'); });
$('new-project').onclick = $('welcome-import').onclick = () => { if (canLeave()) $('base-file').click(); };
$('base-file').onchange = event => action(async () => { const file = event.target.files[0]; if (!file) return; const notebook = await readNotebook(file); await openLocal(notebook, file.name.replace(/\.ipynb$/i, '')); history.replaceState(null, '', '/'); event.target.value = ''; });
$('revision-button').onclick = () => $('revision-file').click();
$('revision-file').onchange = event => action(async () => {
  const file = event.target.files[0]; if (!file || !state.base) return; const notebook = await readNotebook(file); const revision = await snapshot(notebook);
  if (state.project.id) { const rows = await state.api.request('review_projects', query({ id: 'eq.' + state.project.id, version: 'eq.' + state.project.version }), 'PATCH', { revision_notebook: notebook }); if (!rows.length) throw new Error('项目已被其他操作更新，请刷新后重试。'); state.project = rows[0]; }
  else state.project.revision_notebook = notebook;
  state.revision = revision; render(); notice('新版已加载。关闭的反馈若对应内容发生变化，会提示重新核对。'); event.target.value = '';
});
$('comment-form').onsubmit = event => { event.preventDefault(); action(async () => {
  const body = $('comment-body').value.trim(); if (!body || !state.selected || state.busy) return; state.busy = true; $('submit-comment').disabled = true;
  try {
    if (state.project.id) { await state.api.request('review_comments', '', 'POST', { project_id: state.project.id, author_id: state.api.session.user.id, cell_key: state.selected, snapshot_id: state.base.id, body }); $('comment-body').value = ''; await syncComments(); notice('反馈已保存到共享审阅。'); }
    else { state.comments.push({ id: crypto.randomUUID(), snapshotId: state.base.id, cellKey: state.selected, body, author: actor(), resolved: false, createdAt: new Date().toISOString() }); $('comment-body').value = ''; const saved = saveLocal(); renderCells(); renderDiscussion(); updateSummary(); if (saved) notice('反馈已保存在本浏览器。'); }
  } finally { state.busy = false; $('submit-comment').disabled = false; }
}); };
for (const filter of ['all', 'open', 'changed']) $('filter-' + filter).onclick = () => { state.filter = filter; render(); };
$('share').onclick = () => action(showShare);
$('invite-form').onsubmit = event => { event.preventDefault(); action(async () => { const email = $('invite-email').value.trim().toLowerCase(); await state.api.request('review_members', '', 'POST', { project_id: state.project.id, email }); $('invite-email').value = ''; await refreshMembers(); $('share-message').textContent = '已添加。请将审阅链接发给对方，并提醒使用此邮箱登录。'; }); };
$('copy-link').onclick = () => action(async () => { try { await navigator.clipboard.writeText($('share-link').value); $('share-message').textContent = '链接已复制。'; } catch { $('share-link').select(); $('share-message').textContent = '请手动复制上方链接。'; } });
$('refresh-projects').onclick = () => action(listProjects);
$('refresh-review').onclick = () => action(async () => { if (canLeave()) await loadProject(state.project.id); });
$('login-open').onclick = openLogin;
$('logout').onclick = () => action(async () => { if (!canLeave()) return; await state.api.logout(); notice('已退出登录。'); });
$('email').oninput = () => { if (otpEmail && $('email').value.trim().toLowerCase() !== otpEmail) { otpEmail = null; $('otp-step').hidden = true; $('otp').required = false; $('auth-submit').textContent = '发送验证码'; } };
$('login-form').onsubmit = event => { event.preventDefault(); action(async () => {
  $('auth-submit').disabled = true;
  try {
    const email = $('email').value.trim().toLowerCase();
    if (!otpEmail) { await state.api.sendOTP(email); otpEmail = email; $('otp-step').hidden = false; $('otp').required = true; $('auth-submit').textContent = '验证并登录'; $('auth-message').textContent = '已请求验证码，请查看邮箱。未收到时请检查垃圾邮件，或稍后重新打开登录窗口。'; $('otp').focus(); }
    else { await state.api.verifyOTP(otpEmail, $('otp').value.trim()); $('login-dialog').close(); await listProjects(); const id = new URLSearchParams(location.search).get('project'); if (id) await loadProject(id); notice('已登录。'); }
  } catch (error) { $('auth-message').textContent = error.message; }
  finally { $('auth-submit').disabled = false; }
}); };
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => { $(button.dataset.close).close(); if (button.dataset.close === 'login-dialog') { otpEmail = null; $('otp-step').hidden = true; $('otp').required = false; $('auth-submit').textContent = '发送验证码'; } };
$('export-feedback').onclick = () => {
  const comments = state.comments.map(c => ({ id: c.id, snapshotId: state.base.id, cellKey: c.cell_key || c.cellKey, body: c.body, author: c.author_email || c.author, resolved: c.resolved, createdAt: c.created_at || c.createdAt }));
  const blob = new Blob([JSON.stringify({ format: 'notebook-review.feedback.v1', snapshotId: state.base.id, baseNotebook: state.project.base_notebook, name: state.project.title, comments }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = 'notebook-feedback-' + state.base.id.slice(0, 8) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener('beforeunload', event => { if ($('comment-body').value.trim()) { event.preventDefault(); event.returnValue = ''; } });
async function initialize() {
  try { const response = await fetch('/api/config'); const data = await response.json(); if (data.configured) config = { url: data.url, publicKey: data.publicKey }; } catch {}
  if (config) state.api = new ReviewAPI(config, authUI);
  $('setup-note').textContent = config ? '使用邮箱验证码登录。项目仅对发起者和受邀邮箱开放。' : '当前未配置协作服务。示例与本地预览可用，在线共享需先完成部署配置。';
  authUI();
  if (state.api?.session) { await action(async () => { await listProjects(); const id = new URLSearchParams(location.search).get('project'); if (id) await loadProject(id); }); }
  else if (new URLSearchParams(location.search).has('project') && config) { notice('请用受邀邮箱登录以打开这份审阅。'); openLogin(); }
  setInterval(async () => { if (pollBusy || document.hidden || !state.project?.id) return; pollBusy = true; try { await syncComments(); lastPollError = ''; } catch (error) { if (error.message !== lastPollError) notice('同步未完成：' + error.message, true); lastPollError = error.message; } finally { pollBusy = false; } }, 8000);
}
initialize();
