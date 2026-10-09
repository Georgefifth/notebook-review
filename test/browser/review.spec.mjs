import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { snapshot } from '../../public/core.mjs';
const base = JSON.parse(await readFile(new URL('../../public/examples/base.ipynb', import.meta.url)));
const revision = JSON.parse(await readFile(new URL('../../public/examples/revision.ipynb', import.meta.url)));
const snap = await snapshot(base);
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ownerId = '11111111-1111-4111-8111-111111111111';
const reviewerId = '22222222-2222-4222-8222-222222222222';
function fixture() {
  const project = { id: projectId, owner_id: ownerId, title: '共享样本分析', base_notebook: structuredClone(base), snapshot_id: snap.id, revision_notebook: null, version: 1 };
  const comments = [], members = [];
  return { project, comments, members };
}
async function mockBackend(page, store) {
  await page.route('https://testing.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), body = request.postDataJSON?.() || {}, method = request.method(); let data = {};
    if (url.pathname === '/auth/v1/otp') data = {};
    else if (url.pathname === '/auth/v1/verify') { const owner = body.email === 'owner@example.org'; data = { access_token: owner ? 'owner-token' : 'reviewer-token', refresh_token: 'refresh', expires_in: 3600, user: { id: owner ? ownerId : reviewerId, email: body.email } }; }
    else if (url.pathname === '/auth/v1/logout') data = {};
    else if (url.pathname.includes('/rest/v1/')) {
      const owner = request.headers().authorization === 'Bearer owner-token';
      const table = url.pathname.split('/').at(-1);
      if (table === 'review_projects') {
        if (method === 'GET') data = [store.project];
        if (method === 'POST') { Object.assign(store.project,body); data=[store.project]; }
        if (method === 'PATCH') { Object.assign(store.project,body); store.project.version++; data=[store.project]; }
      }
      if (table === 'review_comments') {
        if (method === 'GET') data = store.comments;
        if (method === 'POST') { const comment={...body,id:crypto.randomUUID(),author_email:owner?'owner@example.org':'reviewer@example.org',created_at:new Date().toISOString(),resolved:false,version:1}; store.comments.push(comment); data=[comment]; }
        if (method === 'PATCH') { const id=url.searchParams.get('id').slice(3), c=store.comments.find(c=>c.id===id); Object.assign(c,body); c.version++; data=[c]; }
      }
      if (table === 'review_members') { if(method==='POST')store.members.push(body); if(method==='DELETE')store.members.splice(0); data=store.members; }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } });
  });
}
async function login(page,email) { await page.getByRole('button',{name:'邮箱登录',exact:true}).click(); await page.getByLabel('邮箱地址').fill(email); await page.getByRole('button',{name:'发送验证码',exact:true}).click(); await page.getByLabel('邮箱中的验证码').fill('123456'); await page.getByRole('button',{name:'验证并登录'}).click(); await expect(page.locator('#identity')).toHaveText(email); }
test('local review, draft preservation, changed output and export', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'打开示例审阅 →'}).click(); await expect(page.locator('.cell')).toHaveCount(4);
  await page.locator('#cell-1').getByRole('button',{name:'讨论',exact:true}).click(); await page.getByLabel('你的反馈').fill('请说明缺失值。');
  await page.locator('#cell-2').getByRole('button',{name:'讨论',exact:true}).click(); await expect(page.getByLabel('你的反馈')).toHaveValue('请说明缺失值。'); await expect(page.locator('#notice')).toContainText('草稿');
  await page.getByRole('button',{name:'发送反馈'}).click(); await expect(page.locator('.comment')).toContainText('请说明缺失值。'); await page.getByRole('button',{name:'标记已处理'}).click();
  await page.locator('#revision-file').setInputFiles({ name:'revision.ipynb',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(revision)) }); await expect(page.locator('#cell-1')).toContainText('输出变化'); await expect(page.locator('#comments')).toContainText('新版需复核');
  await page.getByRole('button',{name:'确认已核对新版',exact:true}).click();await expect(page.locator('#comments')).not.toContainText('新版需复核');await expect(page.locator('#summary')).toContainText('0 条待处理');
  const changed=structuredClone(revision);changed.cells[1].source += '\nprint(42)';await page.locator('#revision-file').setInputFiles({name:'next.ipynb',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))});await expect(page.locator('#comments')).toContainText('新版需复核');
  const download = page.waitForEvent('download'); await page.getByRole('button',{name:'导出反馈'}).click(); const saved = await download; expect(saved.suggestedFilename()).toContain('notebook-feedback');
});
test('hostile notebook markup and comments remain inert', async ({page}) => {
  await page.goto('/'); const hostile=structuredClone(base); hostile.cells[0].source='<img src=x onerror="window.HACKED=1"><script>window.HACKED=1</script>'; hostile.cells[1].outputs=[{output_type:'display_data',data:{'text/html':'<script>window.HACKED=1</script>'},metadata:{}}];
  await page.locator('#base-file').setInputFiles({name:'hostile.ipynb',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(hostile))}); await expect(page.locator('#cell-0')).toContainText('<script>'); await expect(page.locator('#cell-1')).toContainText('暂不支持'); expect(await page.evaluate(()=>window.HACKED)).toBeUndefined(); expect(await page.locator('#cell-0 img').count()).toBe(0);
});
test('two-user online workflow with mocked auth/REST; independent SQL tests verify access policies', async ({page,browser}) => {
  const store=fixture(); await mockBackend(page,store); await page.goto('/'); await login(page,'owner@example.org'); await page.locator('.project-item').first().click(); await page.getByRole('button',{name:'邀请合作者',exact:true}).click(); await page.getByLabel('合作者邮箱').fill('reviewer@example.org'); await page.getByRole('button',{name:'添加',exact:true}).click(); await expect(page.locator('#members')).toContainText('reviewer@example.org'); await page.getByRole('button',{name:'关闭邀请窗口'}).click();
  const context=await browser.newContext(); const reviewerPage=await context.newPage(); await mockBackend(reviewerPage,store); await reviewerPage.goto('http://127.0.0.1:4185/'); await login(reviewerPage,'reviewer@example.org'); await reviewerPage.locator('.project-item').first().click(); await expect(reviewerPage.getByRole('button',{name:'邀请合作者',exact:true})).toHaveCount(0);
  await reviewerPage.locator('#cell-1').getByRole('button',{name:'讨论',exact:true}).click(); await reviewerPage.getByLabel('你的反馈').fill('这里的总样本数是什么？'); await reviewerPage.getByRole('button',{name:'发送反馈'}).click(); await expect(reviewerPage.locator('.comment')).toContainText('reviewer@example.org');
  await page.getByRole('button',{name:'刷新审阅',exact:true}).click(); await page.locator('#cell-1').getByRole('button',{name:/讨论/}).click(); await expect(page.locator('.comment')).toContainText('总样本数'); await page.getByRole('button',{name:'标记已处理'}).click();
  await page.locator('#revision-file').setInputFiles({name:'revision.ipynb',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(revision))}); await expect(page.locator('#comments')).toContainText('新版需复核');await page.getByRole('button',{name:'确认已核对新版',exact:true}).click();await expect(page.locator('#comments')).not.toContainText('新版需复核'); await reviewerPage.getByRole('button',{name:'刷新审阅',exact:true}).click(); await expect(reviewerPage.locator('#cell-1')).toContainText('内容修改'); await context.close();
});
test('narrow layout has no horizontal overflow and captures preview', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/'); await page.getByRole('button',{name:'打开示例审阅 →'}).click(); expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('desktop preview and malformed import preserves active review', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000}); await page.goto('/'); await page.getByRole('button',{name:'打开示例审阅 →'}).click(); await page.locator('#cell-1').getByRole('button',{name:'讨论',exact:true}).click(); await page.getByLabel('你的反馈').fill('这里建议说明剔除缺失值后的样本数量。'); await page.getByRole('button',{name:'发送反馈'}).click(); await page.locator('#base-file').setInputFiles({name:'invalid.ipynb',mimeType:'application/json',buffer:Buffer.from('{invalid')}); await expect(page.locator('#notice')).toContainText('有效的 JSON'); await expect(page.locator('.cell')).toHaveCount(4); await page.getByRole('button',{name:'体验示例',exact:true}).click(); await page.locator('#cell-1').getByRole('button',{name:/讨论/}).click(); await page.screenshot({path:'test-results/desktop.png',fullPage:true});
});
test('safe rich Markdown preserves readable tables, lists and code; unsafe URLs stay inert', async ({page}) => {
  await page.goto('/');const rich=structuredClone(base);rich.cells[0].source='# 质量检查\n\n**纳入标准**与 `valid`\n\n- 缺失值已排除\n- 保留有效样本\n\n| 组别 | 数量 |\n| --- | --- |\n| 对照 | 4 |\n\n```python\nx = "<script>"\n```\n\n[危险](javascript:alert(1))\n\n[文档](https://jupyter.org)\n\n![追踪](https://tracker.example/image.png)';
  const remote=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1'))remote.push(r.url());});
  await page.locator('#base-file').setInputFiles({name:'rich.ipynb',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rich))});
  await expect(page.locator('#cell-0 strong')).toHaveText('纳入标准');await expect(page.locator('#cell-0 li')).toHaveCount(2);await expect(page.locator('#cell-0 table')).toContainText('对照');await expect(page.locator('#cell-0 pre')).toContainText('<script>');await expect(page.locator('#cell-0 a')).toHaveCount(1);expect(remote).toEqual([]);
});
test('feedback navigation, search and return preserve draft and locate the context on mobile', async ({page}) => {
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'打开示例审阅 →'}).click();
  await page.locator('#cell-1').getByRole('button',{name:'讨论',exact:true}).click();await page.getByLabel('你的反馈').fill('请确认审阅检索标记XYZ');await page.getByRole('button',{name:'发送反馈'}).click();
  await page.locator('#cell-3').getByRole('button',{name:'讨论',exact:true}).click();await page.getByRole('button',{name:'下一条待处理反馈',exact:true}).click();await expect(page.locator('#discussion-title')).toHaveText('单元格 2');expect(await page.locator('#cell-1').evaluate(n=>n.nextElementSibling?.id)).toBe('discussion');
  await page.getByLabel('你的反馈').fill('保留这条草稿');await page.getByRole('button',{name:'返回当前单元格 ↑'}).click();await expect(page.getByLabel('你的反馈')).toHaveValue('保留这条草稿');expect(await page.locator('#cell-1').evaluate(n=>n.getBoundingClientRect().top>=0&&n.getBoundingClientRect().top<innerHeight)).toBe(true);
  await page.getByLabel('查找内容或反馈').fill('审阅检索标记XYZ');await expect(page.locator('#cell-list .cell')).toHaveCount(1);await expect(page.locator('#cell-1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('example revision is one action and exposes a readable line diff', async ({page}) => {
  await page.goto('/');await page.getByRole('button',{name:'打开示例审阅 →'}).click();await page.getByRole('button',{name:'查看示例修改',exact:true}).click();await expect(page.locator('#cell-1')).toContainText('内容修改');await page.locator('#cell-1 summary').click();await expect(page.locator('#cell-1 .diff-add').first()).toContainText('仪器');await expect(page.locator('#cell-1 .diff-remove')).toHaveCount(1);
  await page.getByLabel('查找内容或反馈').fill('有效样本数');await expect(page.locator('#cell-1')).toBeVisible();
});
test('parallel requests share token refresh and logout cannot resurrect a session', async ({page}) => {
  await page.goto('/');const result=await page.evaluate(async()=>{
    const {ReviewAPI}=await import('./service.mjs');const api=new ReviewAPI({url:'https://testing.supabase.co',publicKey:'sb_publishable_testing'});api.session={access_token:'old',refresh_token:'refresh',expires_at:1,user:{id:'u'}};let calls=0;let complete;
    api.auth=()=>{calls++;return new Promise(resolve=>{complete=resolve;});};const first=api.token(),second=api.token();complete({access_token:'new',refresh_token:'next',expires_in:3600,user:{id:'u'}});const values=await Promise.all([first,second]);
    api.session={access_token:'old',refresh_token:'refresh',expires_at:1,user:{id:'u'}};const pending=api.token().catch(e=>e.message);api.saveSession(null);complete({access_token:'unexpected',refresh_token:'next',expires_in:3600,user:{id:'u'}});await pending;return{calls,values,session:api.session};
  });expect(result.calls).toBe(2);expect(result.values).toEqual(['new','new']);expect(result.session).toBeNull();
});
