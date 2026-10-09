import { MAX_BYTES, snapshot, compare, validateComments } from './core.mjs';
import { ReviewAPI, query } from './service.mjs';
import { renderMarkdown, renderDiff } from './render.mjs';
const $ = id => document.getElementById(id);
const discussionNode = $('discussion');
const narrowLayout = matchMedia('(max-width: 1100px)');
function mountDiscussion() { const index = state.base?.cells.findIndex(c => c.key === state.selected); const card = index >= 0 ? $('cell-' + index) : null; if (narrowLayout.matches && card) card.after(discussionNode); else $('workspace-main').after(discussionNode); }
narrowLayout.addEventListener('change', mountDiscussion);
const state = { project: null, base: null, revision: null, comments: [], selected: null, filter: 'all', demo: false, api: null, busy: false };
let config = null, pollBusy = false, lastPollError = '', otpEmail = null, loadSequence = 0, comparisonCache = null, commentsCache = null;
const appURL = new URL('./', import.meta.url);
const assetURL = path => new URL(path, appURL);
function comparison() {
  if (!state.revision) return null;
  if (comparisonCache?.base !== state.base || comparisonCache?.revision !== state.revision) { const value = compare(state.base, state.revision); comparisonCache = { base: state.base, revision: state.revision, value, byKey: new Map(value.rows.map(row => [row.key, row])) }; }
  return comparisonCache.value;
}
function commentGroups() {
  if (commentsCache?.comments !== state.comments) { const groups = new Map(); for (const c of state.comments) { const key = c.cell_key || c.cellKey; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); } commentsCache = { comments: state.comments, groups }; }
  return commentsCache.groups;
}
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
function notice(message, error = false) { $('notice').textContent = message; $('notice').className = 'notice' + (error ? ' error' : ''); $('notice').hidden = !message; }
async function action(fn) { try { await fn(); } catch (error) { notice(['TimeoutError', 'AbortError'].includes(error.name) ? 'The request timed out. Please try again.' : error.message || 'The action could not be completed.', true); } }
function canLeave() { if (state.busy) { notice('Saving. Please wait before switching reviews.'); return false; } if (!$('comment-body').value.trim()) return true; return confirm('This feedback has not been sent. Discard the draft and continue?'); }
function resetSelection() { state.selected = null; $('comment-body').value = ''; }
function actor() { return state.demo ? 'Example reviewer' : state.api?.session?.user?.email || 'Local reviewer'; }
function owner() { return state.demo || !state.project?.id || state.api?.session?.user?.id === state.project.owner_id; }
function authUI() {
  const session = state.api?.session;
  if (!session) loadSequence++;
  $('identity').textContent = session?.user?.email || ''; $('identity').hidden = !session;
  $('refresh-projects').hidden = !session; $('logout').hidden = !session; $('login-open').hidden = !!session || !config;
  $('mode').textContent = !config ? 'Local demo · No backend connected' : session ? 'Online workspace' : 'Sign in to share';
  if (!session && state.project?.id) { state.project = null; state.base = null; state.comments = []; state.revision = null; resetSelection(); render(); $('project-list').replaceChildren(); }
}
function openLogin() { if (!config) { notice('Online services are not configured. Try the example or review locally; sharing requires backend setup.', true); return; } $('login-dialog').showModal(); $('email').focus(); }
async function readNotebook(file) { if (!file || file.size > MAX_BYTES) throw new Error('Choose an .ipynb file up to 5 MB.'); let notebook; try { notebook = JSON.parse(await file.text()); } catch { throw new Error('The file is not a valid JSON Notebook.'); } await snapshot(notebook); return notebook; }
function localStoreKey() { return 'nr-comments:' + state.base.id; }
function saveLocal() { try { localStorage.setItem(localStoreKey(), JSON.stringify(state.comments)); return true; } catch { notice('This browser could not save feedback locally. Use Export feedback to save a copy.', true); return false; } }
async function openLocal(notebook, title, demo = false) {
  const sequence = ++loadSequence; const base = await snapshot(notebook); if (sequence !== loadSequence) return;
  let comments = [];
  try { const saved = JSON.parse(localStorage.getItem('nr-comments:' + base.id) || '[]'); comments = validateComments(saved, base); } catch { notice('Stored feedback is unavailable. Starting a fresh review.', true); }
  state.project = { title, base_notebook: notebook, snapshot_id: base.id }; state.base = base; state.revision = null; state.comments = comments; state.demo = demo; state.filter = 'all'; $('cell-search').value = ''; resetSelection(); render();
  notice((demo ? 'This is a synthetic example. Comments are saved only in this browser. ' : 'Opened locally. The file has not been uploaded. ') + (config ? 'Choose Share online to create an online review.' : 'Export feedback to save a record. Cross-device sharing is unavailable.'));
}
async function listProjects() {
  if (!state.api?.session) return;
  const session = state.api.session;
  const projects = await state.api.request('review_projects', query({ select: 'id,title,owner_id,created_at', order: 'created_at.desc' }));
  if (state.api.session?.user?.id !== session.user.id) return;
  const list = $('project-list'); list.replaceChildren();
  if (!projects.length) list.append(el('p', 'No online reviews yet. Import a Notebook or share the example.', 'empty'));
  for (const project of projects) { const button = el('button', project.title, 'project-item' + (state.project?.id === project.id ? ' active' : '')); button.append(el('small', project.owner_id === state.api.session.user.id ? 'Owned by you' : 'Invited review')); button.onclick = () => action(async () => { if (canLeave()) await loadProject(project.id); }); list.append(button); }
}
async function loadProject(id) {
  const sequence = ++loadSequence;
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('The review link is invalid.');
  const projects = await state.api.request('review_projects', query({ id: 'eq.' + id, select: '*' }));
  if (!projects.length) throw new Error('This review is unavailable. Sign in with your invited email, or ask the owner to add your address.');
  const project = projects[0], base = await snapshot(project.base_notebook);
  if (base.id !== project.snapshot_id) throw new Error('Snapshot verification failed. Loading stopped.');
  const revision = project.revision_notebook ? await snapshot(project.revision_notebook) : null;
  const comments = await state.api.request('review_comments', query({ project_id: 'eq.' + id, order: 'created_at.asc' }));
  if (sequence !== loadSequence) return;
  state.project = project; state.base = base; state.revision = revision; state.comments = comments; state.demo = false; state.filter = 'all'; $('cell-search').value = ''; resetSelection();
  history.replaceState(null, '', appURL.pathname + '?project=' + id); render(); await listProjects(); notice('Review synchronized.');
}
async function createOnlineProject() {
  if (!config) { openLogin(); return false; }
  if (!state.api?.session) { openLogin(); return false; }
  const local = state.project;
  const rows = await state.api.request('review_projects', '', 'POST', { title: local.title.slice(0, 160), owner_id: state.api.session.user.id, base_notebook: local.base_notebook, snapshot_id: state.base.id, revision_notebook: local.revision_notebook || null });
  if (!rows[0]?.id) throw new Error('Creating the review did not return a project ID.');
  // Local comments are not silently attributed to an authenticated account.
  await loadProject(rows[0].id);
  notice('Online review created. Local demo feedback was not uploaded. Online comments use your signed-in email.');
  return true;
}
function renderContent(container, cell) {
  if (cell.type === 'markdown') { renderMarkdown(container, cell.source); if (Object.keys(cell.attachments).length) container.append(el('small', 'Attachments are not rendered. Check them in the original Notebook.')); }
  else container.append(el('pre', cell.source, 'code'));
  if (!cell.outputs.length) return;
  const output = el('div', undefined, 'output'); output.append(el('span', 'Saved output', 'output-label'));
  for (const item of cell.outputs) {
    if (item.output_type === 'stream') { try { output.append(el('pre', textValueUI(item.text))); } catch { output.append(el('small', 'This text output format is unsupported.')); } continue; }
    if (item.output_type === 'error') { output.append(el('pre', [item.ename, item.evalue].filter(Boolean).join(': '), 'traceback')); continue; }
    const data = item.data || {}; let displayed = false;
    for (const mime of ['image/png', 'image/jpeg']) {
      if (!data[mime]) continue;
      const encoded = Array.isArray(data[mime]) ? data[mime].join('') : data[mime];
      if (typeof encoded === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(encoded) && encoded.length <= MAX_BYTES) { const img = el('img'); img.src = 'data:' + mime + ';base64,' + encoded.replace(/\s/g, ''); img.alt = 'Saved Notebook image output'; output.append(img); displayed = true; break; }
    }
    if (!displayed && data['text/plain']) { output.append(el('pre', textValueUI(data['text/plain']))); displayed = true; }
    if (!displayed) output.append(el('small', 'This output has no supported safe preview (HTML, SVG or interactive widgets). Check the original Notebook.'));
  }
  container.append(output);
}
function textValueUI(value) { return typeof value === 'string' ? value : Array.isArray(value) ? value.filter(v => typeof v === 'string').join('') : ''; }
function rowFor(key) { comparison(); return state.revision ? comparisonCache.byKey.get(key) : null; }
function needsRecheck(comment) { const row = rowFor(comment.cell_key || comment.cellKey); const acknowledged = state.project.id ? comment.reviewed_revision_version === state.project.version : comment.reviewedRevisionId === state.revision?.id; return comment.resolved && row && (row.status !== 'unchanged') && !acknowledged; }
function isOpen(comment) { return !comment.resolved || needsRecheck(comment); }
function commentsFor(key) { return commentGroups().get(key) || []; }
function appendBadge(node, text, warning = false) { node.append(el('span', text, 'badge' + (warning ? ' warn' : ''))); }
function cellCard(cell, index, row, added = false) {
  const card = el('article', undefined, 'cell' + (state.selected === cell.key && !added ? ' selected' : '') + (row?.status === 'changed' ? ' changed' : '')); card.id = (added ? 'added-' : 'cell-') + index; card.dataset.cellKey = cell.key;
  const head = el('div', undefined, 'cell-head'), title = el('span', 'Cell ' + (index + 1) + ' · ' + ({ markdown: 'Markdown', code: 'Code', raw: 'Raw text' }[cell.type])); head.append(title);
  if (row) {
    if (row.sourceChanged) appendBadge(title, 'Content changed', true);
    if (row.outputChanged) appendBadge(title, 'Output changed', true);
    if (row.moved) appendBadge(title, 'Moved');
    if (row.status === 'removed') appendBadge(title, 'Removed in revision', true);
    if (row.status === 'unlinked') appendBadge(title, 'Match uncertain', true);
    if (row.method === 'unique-source') appendBadge(title, 'Matched by unique content');
  }
  if (!added) { const comments = commentsFor(cell.key); const button = el('button', 'Discuss' + (comments.length ? ' · ' + comments.length : '')); button.onclick = () => selectCell(cell.key); head.append(button); }
  card.append(head);
  if (row && row.status === 'changed' && row.revisionIndex !== null) { const wrap = el('div', undefined, 'comparison'); for (const [label, content] of [['Original snapshot', cell], ['Revision · Cell ' + (row.revisionIndex + 1), state.revision.cells[row.revisionIndex]]]) { const pane = el('div', undefined, 'cell-body'); pane.append(el('span', label, 'pane-label')); renderContent(pane, content); wrap.append(pane); } card.append(wrap); if (row.sourceChanged) renderDiff(card, cell.source, state.revision.cells[row.revisionIndex].source); }
  else { const body = el('div', undefined, 'cell-body'); renderContent(body, cell); card.append(body); }
  return card;
}
function renderCells() {
  $('workspace-main').after(discussionNode);
  const list = $('cell-list'); list.replaceChildren(); if (!state.base) return;
  const result = comparison();
  const search = $('cell-search').value.trim().toLocaleLowerCase();
  const matchesSearch = cell => { const row = rowFor(cell.key), newer = row?.revisionIndex !== null && row?.revisionIndex !== undefined ? state.revision.cells[row.revisionIndex] : null; return !search || (cell.source + '\n' + JSON.stringify(cell.outputs) + '\n' + (newer ? newer.source + JSON.stringify(newer.outputs) : '') + '\n' + commentsFor(cell.key).map(c => c.body).join('\n')).toLocaleLowerCase().includes(search); };
  state.base.cells.forEach((cell, index) => { const row = result?.rows[index]; if (!matchesSearch(cell)) return; if (state.filter === 'open' && !commentsFor(cell.key).some(isOpen)) return; if (state.filter === 'changed' && (!row || row.status === 'unchanged' && !row.moved)) return; list.append(cellCard(cell, index, row)); });
  if (!list.childElementCount) list.append(el('p', state.filter === 'changed' && !state.revision ? 'Upload a revised Notebook to see changes here.' : 'No cells match these filters.', 'empty'));
  $('added-section').hidden = !result?.added.length || state.filter === 'open'; $('added-list').replaceChildren();
  if (result) for (const index of result.added) if (matchesSearch(state.revision.cells[index])) $('added-list').append(cellCard(state.revision.cells[index], index, null, true));
  $('added-section').hidden = !$('added-list').childElementCount || state.filter === 'open'; mountDiscussion();
}
function renderDiscussion() {
  const cell = state.base?.cells.find(c => c.key === state.selected), list = $('comments'); list.replaceChildren();
  $('comment-form').hidden = !cell; $('discussion-title').textContent = cell ? 'Cell ' + (state.base.cells.indexOf(cell) + 1) : 'Select a cell'; $('discussion-context').textContent = cell ? 'Original snapshot · ' + cell.source.replace(/\s+/g, ' ').slice(0, 110) : 'Choose Discuss to leave feedback beside the relevant content.';
  $('back-to-cell').hidden = !cell;
  renderFeedbackIndex();
  $('comment-author').textContent = actor(); $('draft-note').hidden = true;
  if (!cell) return;
  const comments = commentsFor(cell.key);
  if (!comments.length) list.append(el('p', 'No feedback yet. Start with a specific question.', 'empty'));
  for (const comment of comments) {
    const card = el('div', undefined, 'comment' + (comment.resolved ? ' resolved' : '')); const meta = el('div', undefined, 'comment-meta'); meta.append(el('span', comment.author_email || comment.author), el('time', new Date(comment.created_at || comment.createdAt).toLocaleDateString('en-GB'))); card.append(meta, el('p', comment.body));
    if (needsRecheck(comment)) appendBadge(card, 'Previously resolved · Revision needs review', true);
    else if (comment.resolved) appendBadge(card, 'Resolved');
    const editable = !state.project.id || owner() || comment.author_id === state.api?.session?.user?.id;
    if (editable) { const recheck = needsRecheck(comment); const button = el('button', recheck ? 'Confirm revision reviewed' : comment.resolved ? 'Reopen' : 'Mark resolved'); button.onclick = () => action(async () => {
      if (state.project.id) { const rows = await state.api.request('review_comments', query({ id: 'eq.' + comment.id, version: 'eq.' + comment.version }), 'PATCH', { resolved: recheck || !comment.resolved, reviewed_revision_version: (recheck || !comment.resolved) && state.revision ? state.project.version : null }); if (!rows.length) throw new Error('Someone else updated this feedback. Refresh before trying again.'); await syncComments(); }
      else { comment.resolved = recheck || !comment.resolved; comment.reviewedRevisionId = comment.resolved && state.revision ? state.revision.id : null; saveLocal(); renderCells(); renderDiscussion(); updateSummary(); }
    }); card.append(button); }
    list.append(card);
  }
}
function updateSummary() { const open = state.comments.filter(isOpen).length; $('summary').textContent = state.base.cells.length + ' cells · ' + open + ' pending feedback'; }
function render() {
  const ready = !!state.base; $('welcome').hidden = ready; $('workspace').hidden = !ready; if (!ready) { mountDiscussion(); $('cell-list').replaceChildren(); $('added-list').replaceChildren(); comparisonCache = null; commentsCache = null; renderDiscussion(); return; }
  $('project-title').textContent = state.project.title; $('project-context').textContent = state.project.id ? 'Shared review · ' + (owner() ? 'Owned by you' : 'Invited collaborator') : state.demo ? 'Example review · Local only' : 'Local preview · Not shared';
  $('project-subtitle').textContent = 'Review snapshot ' + state.base.id.slice(0, 12) + (state.revision ? ' · Comparing revision' : ' · Original file preserved');
  $('share').hidden = !owner() || !config; $('demo-revision').hidden = !state.demo || !!state.revision; $('share').textContent = state.project.id ? 'Invite collaborators' : 'Share online'; $('revision-button').hidden = !owner(); $('refresh-review').hidden = !state.project.id;
  $('comparison-note').hidden = !state.revision;
  for (const filter of ['all', 'open', 'changed']) { $('filter-' + filter).classList.toggle('active', state.filter === filter); $('filter-' + filter).setAttribute('aria-pressed', String(state.filter === filter)); }
  updateSummary(); renderCells(); renderDiscussion();
}
async function syncComments() {
  const projectId = state.project?.id; if (!projectId || !state.api?.session) return;
  const comments = await state.api.request('review_comments', query({ project_id: 'eq.' + projectId, order: 'created_at.asc' }));
  if (state.project?.id !== projectId) return;
  if (JSON.stringify(comments) !== JSON.stringify(state.comments)) { state.comments = comments; renderCells(); renderDiscussion(); updateSummary(); }
}
async function showShare() {
  if (state.busy) return; state.busy = true; $('share').disabled = true;
  try { if (!state.project.id && !(await createOnlineProject())) return;
    $('share-dialog').showModal(); $('share-link').value = appURL.href + '?project=' + state.project.id; await refreshMembers();
  } finally { state.busy = false; $('share').disabled = false; }
}
async function refreshMembers() {
  const members = await state.api.request('review_members', query({ project_id: 'eq.' + state.project.id, order: 'invited_at.asc' })); $('members').replaceChildren();
  for (const member of members) { const row = el('div', undefined, 'member'); row.append(el('span', member.email)); const button = el('button', 'Remove access'); button.onclick = () => action(async () => { await state.api.request('review_members', query({ project_id: 'eq.' + state.project.id, email: 'eq.' + member.email }), 'DELETE'); await refreshMembers(); $('share-message').textContent = 'Access removed. Previously downloaded copies cannot be recalled.'; }); row.append(button); $('members').append(row); }
}
$('demo').onclick = $('welcome-demo').onclick = () => action(async () => { if (!canLeave()) return; const response = await fetch(assetURL('examples/base.ipynb')); await openLocal(await response.json(), 'Sample quality analysis · Synthetic example', true); history.replaceState(null, '', appURL.pathname); });
$('new-project').onclick = $('welcome-import').onclick = () => { if (canLeave()) $('base-file').click(); };
$('base-file').onchange = event => action(async () => { const file = event.target.files[0]; if (!file) return; const notebook = await readNotebook(file); await openLocal(notebook, file.name.replace(/\.ipynb$/i, '')); history.replaceState(null, '', appURL.pathname); event.target.value = ''; });
$('revision-button').onclick = () => $('revision-file').click();
$('revision-file').onchange = event => action(async () => {
  const file = event.target.files[0]; if (!file || !state.base || state.busy) return; state.busy = true; $('revision-button').disabled = true;
  try { const notebook = await readNotebook(file); const revision = await snapshot(notebook);
  if (state.project.id) { const rows = await state.api.request('review_projects', query({ id: 'eq.' + state.project.id, version: 'eq.' + state.project.version }), 'PATCH', { revision_notebook: notebook }); if (!rows.length) throw new Error('This project was updated elsewhere. Refresh and try again.'); state.project = rows[0]; }
  else state.project.revision_notebook = notebook;
  state.revision = revision; render(); notice('Revision loaded. Resolved feedback on changed content needs another review.');
  } finally { state.busy = false; $('revision-button').disabled = false; event.target.value = ''; }
});
$('comment-form').onsubmit = event => { event.preventDefault(); action(async () => {
  const body = $('comment-body').value.trim(); if (!body || !state.selected || state.busy) return; state.busy = true; $('submit-comment').disabled = true; const project = state.project, selected = state.selected;
  try {
    if (state.project.id) { await state.api.request('review_comments', '', 'POST', { project_id: state.project.id, author_id: state.api.session.user.id, cell_key: state.selected, snapshot_id: state.base.id, body }); if (state.project !== project) return; if (state.selected === selected && $('comment-body').value.trim() === body) $('comment-body').value = ''; await syncComments(); notice('Feedback saved to the shared review.'); }
    else { state.comments = [...state.comments, { id: crypto.randomUUID(), snapshotId: state.base.id, cellKey: state.selected, body, author: actor(), resolved: false, createdAt: new Date().toISOString() }]; $('comment-body').value = ''; const saved = saveLocal(); renderCells(); renderDiscussion(); updateSummary(); if (saved) notice('Feedback saved in this browser.'); }
  } finally { state.busy = false; $('submit-comment').disabled = false; }
}); };
for (const filter of ['all', 'open', 'changed']) $('filter-' + filter).onclick = () => { state.filter = filter; render(); };
$('share').onclick = () => action(showShare);
$('invite-form').onsubmit = event => { event.preventDefault(); action(async () => { const email = $('invite-email').value.trim().toLowerCase(); await state.api.request('review_members', '', 'POST', { project_id: state.project.id, email }); $('invite-email').value = ''; await refreshMembers(); $('share-message').textContent = 'Collaborator added. Send them the review link and ask them to sign in with this email.'; }); };
$('copy-link').onclick = () => action(async () => { try { await navigator.clipboard.writeText($('share-link').value); $('share-message').textContent = 'Link copied.'; } catch { $('share-link').select(); $('share-message').textContent = 'Please copy the link above manually.'; } });
$('refresh-projects').onclick = () => action(listProjects);
$('refresh-review').onclick = () => action(async () => { if (canLeave()) await loadProject(state.project.id); });
$('login-open').onclick = openLogin;
$('logout').onclick = () => action(async () => { if (!canLeave()) return; await state.api.logout(); notice('Signed out.'); });
$('email').oninput = () => { if (otpEmail && $('email').value.trim().toLowerCase() !== otpEmail) { otpEmail = null; $('otp-step').hidden = true; $('otp-resend').hidden = true; $('otp').required = false; $('auth-submit').textContent = 'Send code'; } };
$('login-form').onsubmit = event => { event.preventDefault(); action(async () => {
  $('auth-submit').disabled = true;
  try {
    const email = $('email').value.trim().toLowerCase();
    if (!otpEmail) { await state.api.sendOTP(email); otpEmail = email; $('otp-step').hidden = false; $('otp-resend').hidden = false; $('otp').required = true; $('auth-submit').textContent = 'Verify and sign in'; $('auth-message').textContent = 'Code requested. Check your inbox and spam folder. If needed, reopen sign-in later.'; $('otp').focus(); }
    else { await state.api.verifyOTP(otpEmail, $('otp').value.trim()); $('login-dialog').close(); await listProjects(); const id = new URLSearchParams(location.search).get('project'); if (id) await loadProject(id); notice('Signed in.'); }
  } catch (error) { $('auth-message').textContent = error.message; }
  finally { $('auth-submit').disabled = false; }
}); };
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => { $(button.dataset.close).close(); if (button.dataset.close === 'login-dialog') { otpEmail = null; $('otp-step').hidden = true; $('otp-resend').hidden = true; $('otp').required = false; $('auth-submit').textContent = 'Send code'; } };
$('export-feedback').onclick = () => {
  const comments = state.comments.map(c => ({ id: c.id, snapshotId: state.base.id, cellKey: c.cell_key || c.cellKey, body: c.body, author: c.author_email || c.author, resolved: c.resolved, reviewedRevisionId: state.project.id ? c.reviewed_revision_version === state.project.version ? state.revision?.id || null : null : c.reviewedRevisionId || null, createdAt: c.created_at || c.createdAt }));
  const blob = new Blob([JSON.stringify({ format: 'notebook-review.feedback.v1', snapshotId: state.base.id, baseNotebook: state.project.base_notebook, name: state.project.title, comments }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = 'notebook-feedback-' + state.base.id.slice(0, 8) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function selectCell(key, navigate = false) {
  if (state.selected !== key && $('comment-body').value.trim()) { notice('Post or clear your draft before switching cells.', true); $('draft-note').hidden = false; return; }
  if (navigate) { state.filter = 'all'; $('cell-search').value = ''; }
  state.selected = key;
  if (navigate) render(); else { for (const card of $('cell-list').children) card.classList.toggle('selected', card.dataset.cellKey === key); renderDiscussion(); }
  mountDiscussion(); $('comment-body').focus();
}
function renderFeedbackIndex() {
  const list = $('feedback-index'); list.replaceChildren(); if (!state.base) return;
  const pending = state.comments.filter(isOpen); $('next-open').disabled = !pending.length;
  if (!pending.length) return;
  list.append(el('span', 'Pending feedback · ' + pending.length, 'eyebrow'));
  for (const comment of pending) { const index = state.base.cells.findIndex(c => c.key === (comment.cell_key || comment.cellKey)); if (index < 0) continue; const button = el('button', 'Cell ' + (index + 1) + ' · ' + comment.body.slice(0, 65), 'feedback-jump'); button.onclick = () => selectCell(state.base.cells[index].key, true); list.append(button); }
}
$('back-to-cell').onclick = () => { state.filter = 'all'; $('cell-search').value = ''; render(); const index = state.base.cells.findIndex(c => c.key === state.selected); const card = $('cell-' + index); card.tabIndex = -1; card.focus({preventScroll:true}); card.scrollIntoView({block:'start'}); };
$('next-open').onclick = () => { const keys = [...new Set(state.comments.filter(isOpen).map(c => c.cell_key || c.cellKey))]; const index = keys.indexOf(state.selected); if (keys.length) selectCell(keys[(index + 1) % keys.length], true); };
let searchTimer;
$('cell-search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderCells, 120); };
$('demo-revision').onclick = () => action(async () => { if (state.busy) return; const project = state.project; const response = await fetch(assetURL('examples/revision.ipynb')); const notebook = await response.json(); const revision = await snapshot(notebook); if (state.project !== project || !state.demo) return; state.project.revision_notebook = notebook; state.revision = revision; render(); notice('Example revision loaded. Check the changes and saved output before resolving feedback.'); });
$('otp-resend').onclick = () => action(async () => { if (!otpEmail) return; $('otp-resend').disabled = true; try { await state.api.sendOTP(otpEmail); $('auth-message').textContent = 'Another code has been requested. Check your inbox.'; } catch (error) { $('auth-message').textContent = error.message; } finally { $('otp-resend').disabled = false; } });

window.addEventListener('beforeunload', event => { if ($('comment-body').value.trim()) { event.preventDefault(); event.returnValue = ''; } });
async function initialize() {
  try { const response = await fetch(assetURL('config.json')); const data = await response.json(); if (data.configured && typeof data.url === 'string' && typeof data.publicKey === 'string') config = { url: data.url, publicKey: data.publicKey }; } catch {}
  if (config) state.api = new ReviewAPI(config, authUI);
  $('setup-note').textContent = config ? 'Sign in with an email code. Reviews are accessible only to their owner and invited emails.' : 'Online collaboration is not configured. Try the example or review locally. Sharing requires backend setup.';
  authUI();
  if (state.api?.session) { await action(async () => { await listProjects(); const id = new URLSearchParams(location.search).get('project'); if (id) await loadProject(id); }); }
  else if (new URLSearchParams(location.search).has('project') && config) { notice('Sign in with your invited email to open this review.'); openLogin(); }
  setInterval(async () => { if (pollBusy || document.hidden || !state.project?.id) return; pollBusy = true; try { await syncComments(); lastPollError = ''; } catch (error) { if (error.message !== lastPollError) notice('Synchronization failed: ' + error.message, true); lastPollError = error.message; } finally { pollBusy = false; } }, 8000);
}
initialize();
