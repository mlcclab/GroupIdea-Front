import {escapeHTML as e, renderMarkdown, currentWeek, titleFromMarkdown, validateUpload, makeReport, dateLabel, weekLabel} from './core.mjs';
import {GroupIdeaService} from './service.mjs';
import {weeklyTemplate} from './template.mjs';

const config = window.GROUPIDEA_CONFIG || {};
const app = document.querySelector('#app');
let state = {user:null,route:'mine',file:null,title:'',week:currentWeek(),records:[],posts:[],files:[],page:0,busy:false,preview:false,error:'',mineError:'',sharedError:'',pending:null};
const service = new GroupIdeaService();
let toastTimer;
const icons = {
  book:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8m-8 4h5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  exit:'<path d="M9 4H4v16h5m6-12 4 4-4 4M9 12h10"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
const brand = `<span class="brand-symbol">G<span>i</span></span><span class="brand-word">GroupIdea<span>每周思考</span></span>`;
function toast(message) { const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'),4500); }
function download(content,name) {
  const url = URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'}));
  const a = document.createElement('a'); a.href=url; a.download=name.replace(/[\\/\x00-\x1f]/g,'_'); a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function errorBox(message) { return message ? `<div class="error" role="alert">${e(message)}</div>` : ''; }
function empty(title,description) { return `<div class="empty">${icon('book')}<h3>${title}</h3><p>${description}</p></div>`; }
function render() {
  app.innerHTML = state.user ? shell() : login();
  bind();
}
function login() {
  const memberForm = `<form id="member-form"><label for="username">用户名</label><input id="username" autocomplete="username" required placeholder="管理员分配的用户名"><label for="password" class="spaced-label">密码</label><input id="password" type="password" autocomplete="current-password" required placeholder="管理员分配的密码">${errorBox(state.error)}<button class="button primary wide" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '正在登录…' : '登录'} ${icon('arrow')}</button><p class="form-note">账号由管理员提供。无需 GitHub 账号，无需操作仓库。</p></form>`;
  return `<main class="login-layout" id="main"><section class="login-story"><div class="brand">${brand}</div><div class="story-body"><div class="eyebrow">${e(config.groupName || '课题组')} / 每周记录</div><h1>让思考留下痕迹，<br>让下一步更清楚。</h1><p>记录一个问题、一点认识的变化，<br>或一个还没想明白的地方。</p><div class="story-note"><span>本周，从这里开始</span><p>“我想弄清楚什么，<br>什么证据改变了我的想法？”</p><div class="note-rule"></div><small>不必等到有了结论才记录。</small></div></div><div class="story-footer">个人记录 · 组内交流 · 持续积累</div></section><section class="login-panel"><div class="login-card"><div class="eyebrow blue">欢迎回来</div><h2>进入你的思考空间</h2><p class="muted">用自己的话，留下这一周的思考。</p>${memberForm}<p class="login-footnote">不开放注册 · 仅供受邀成员使用</p></div><footer>GroupIdea <span>课题组每周思考</span></footer></section></main>`;
}
function shell() {
  const mine = state.route === 'mine' || (state.route === 'read' && state.readFrom === 'mine');
  return `<div class="workspace"><aside class="sidebar"><a class="brand" href="#mine" aria-label="GroupIdea 首页">${brand}</a><div class="workspace-label">${e(config.groupName || '课题组')} 工作空间</div><nav aria-label="主要导航"><a href="#mine" class="nav-link ${mine ? 'active' : ''}" ${mine ? 'aria-current="page"' : ''}>${icon('book')} 我的想法</a><a href="#others" class="nav-link ${state.route === 'others' || (state.route === 'read' && state.readFrom === 'others') ? 'active' : ''}" ${state.route === 'others' || (state.route === 'read' && state.readFrom === 'others') ? 'aria-current="page"' : ''}>${icon('people')} 看看别人怎么想</a>${state.user.role === 'admin' ? `<a href="#admin" class="nav-link ${state.route === 'admin' ? 'active' : ''}">${icon('people')} 成员管理</a>` : ''}</nav><div class="sidebar-bottom"><div class="privacy-note">${icon('check')}<span>原始记录仅提交给导师<br>整理后再在组内分享</span></div><div class="user-block"><span class="avatar">${e(Array.from(state.user.name || state.user.login)[0])}</span><span class="user-name">${e(state.user.name || state.user.login)}<small>${e(state.user.login)}</small></span><button class="icon-button" data-action="logout" aria-label="退出登录" title="退出">${icon('exit')}</button></div></div></aside><div class="main-wrap"><header class="topbar"><span>${state.route === 'admin' ? '成员管理' : mine ? '个人记录' : '组内交流'}</span><span class="mode-tag"><span class="status-dot"></span>私有工作空间</span></header><main id="main" class="content" tabindex="-1" aria-busy="${state.busy}">${state.route === 'admin' ? adminPage() : state.route === 'read' ? reader() : state.route === 'others' ? others() : minePage()}</main><footer class="workspace-footer"><span>GroupIdea · 每一点思考，都值得留下</span><span>时间显示：北京时间</span></footer></div></div>`;
}
function minePage() {
  return `<div class="page-heading"><div><div class="eyebrow">MY IDEAS</div><h1>我的想法<span class="heading-dot">.</span></h1><p>留下本周最重要的一点思考。</p></div><button class="button secondary" data-action="template">${icon('download')} 下载记录模板</button></div><div class="write-grid"><section class="panel upload-panel"><div class="section-heading"><h2>提交一份新记录</h2><span class="subtle">Markdown</span></div><form id="upload-form"><input id="file-input" class="visually-hidden" type="file" accept=".md,.markdown,text/markdown" aria-label="选择 Markdown 文件"><label for="file-input" id="dropzone" class="dropzone ${state.file ? 'selected' : ''}" tabindex="0" role="button">${icon(state.file ? 'file' : 'upload')}<strong>${state.file ? e(state.file.name) : '拖入 Markdown 文件，或点击选择'}</strong><span>${state.file ? `${(state.file.size/1024).toFixed(1)} KB · 点击更换文件` : '支持 .md / .markdown，最大 512 KB'}</span></label><div class="form-row"><div class="field"><label for="report-title">记录标题</label><input id="report-title" maxlength="100" value="${e(state.title)}" placeholder="这周，你在思考什么？" required></div><div class="field week-field"><label for="report-week">报告所属周</label><input id="report-week" type="week" value="${e(state.week)}" required pattern="20[0-9]{2}-W[0-9]{2}" placeholder="2026-W37"></div></div>${errorBox(state.error)}<div class="upload-actions"><span>提交人：<strong>${e(state.user.name || state.user.login)}</strong></span><div><button class="button text-button" type="button" data-action="preview" ${!state.file || state.busy ? 'disabled' : ''}>${state.preview ? '收起预览' : '预览正文'}</button><button class="button primary" type="submit" ${!state.file || state.busy ? 'disabled' : ''}>${state.busy ? '正在提交…' : '提交记录'} ${icon('arrow')}</button></div></div><p class="form-note submission-note">再次提交会保留为新记录。原稿先交给导师，不会自动出现在组内分享中。</p></form>${state.preview && state.file ? `<div class="inline-preview markdown">${renderMarkdown(state.file.content)}</div>` : ''}</section><aside class="thinking-note"><span class="small-number">每周 · 5–10 分钟</span><h2>从一个小问题开始</h2><ol><li>我这周最想弄清楚什么？</li><li>什么证据改变了我的想法？</li><li>下一步，我想先试什么？</li></ol><p>还没有答案，也可以记录。<br>不确定的地方，就是讨论的起点。</p></aside></div><section class="history-section"><div class="section-heading"><h2>我的提交记录 <span class="count">${state.records.length}${state.files.length > state.records.length ? '+' : ''}</span></h2><button class="button text-button" data-action="refresh">刷新记录</button></div>${errorBox(state.mineError)}${state.records.length ? `<div class="record-list">${state.records.map((r,i)=>`<button class="record-row" data-record="${i}"><span class="file-badge">${icon('file')}</span><span class="record-copy"><strong>${e(r.title)}</strong><small>${e(weekLabel(r.week))} <span>·</span> ${e(dateLabel(r.submittedAt))}</small></span><span class="record-status">已提交</span>${icon('arrow')}</button>`).join('')}</div>${state.files.length > state.page * 10 ? '<button class="button secondary load-more" data-action="more">加载更早记录</button>' : ''}` : state.mineError ? '' : empty('还没有提交记录','选一份 Markdown，留下这一周的想法。')}</section>`;
}
function others() {
  return `<div class="page-heading"><div><div class="eyebrow">SHARED IDEAS</div><h1>看看别人怎么想<span class="heading-dot">.</span></h1><p>由导师整理发布，保留每位成员的问题与认识。</p></div><button class="button secondary" data-action="refresh">刷新内容</button></div><div class="section-heading feed-heading"><h2>最近的思考</h2><span class="subtle">${state.posts.length} 篇 · 按发布时间排序</span></div>${errorBox(state.sharedError)}${state.posts.length ? `<section class="post-list">${state.posts.map((p,i)=>`<button class="post-card" data-post="${i}"><span class="post-number">${String(i+1).padStart(2,'0')}</span><span class="post-body"><span class="post-meta"><span class="author-chip">${e(p.author)}</span>${e(p.week ? weekLabel(p.week) : '组内分享')}</span><strong>${e(p.title)}</strong>${p.excerpt ? `<span class="excerpt">${e(p.excerpt)}</span>` : ''}<span class="post-date">${e(dateLabel(p.publishedAt))} 发布</span></span><span class="post-arrow">${icon('arrow')}</span></button>`).join('')}</section>` : state.sharedError ? '' : empty('这里等待第一份分享','导师发布整理后的内容后，会在这里展示。你的原始提交不会自动公开。')}`;
}
function reader() {
  const r = state.reading;
  return `<div class="reader-toolbar"><button class="button text-button" data-action="back">${icon('back')} 返回${state.readFrom === 'mine' ? '我的想法' : '分享列表'}</button><button class="button secondary" data-action="download">${icon('download')} 下载 Markdown</button></div><article class="reader"><div class="eyebrow">${state.readFrom === 'mine' ? 'MY RECORD' : 'SHARED NOTE'}</div><h1>${e(r.title)}</h1><div class="reader-meta"><span class="author-chip">${e(r.displayName || r.author)}</span>${r.week ? `<span>${e(weekLabel(r.week))}</span>` : ''}<span>${e(dateLabel(r.submittedAt || r.publishedAt))}</span></div><div class="markdown">${renderMarkdown(r.content)}</div></article>`;
}
async function loadMine(reset = true) {
  state.mineError = '';
  try {
    if (reset) { state.files = await service.listReports(); state.records=[]; state.page=0; }
    const batch = state.files.slice(state.page*10,(state.page+1)*10);
    // Ten bounded reads per page; a malformed record does not conceal valid records.
    const results = await Promise.allSettled(batch.map(f => service.readReport(f.path)));
    let failed=0;
    for (const result of results) { if(result.status === 'fulfilled') state.records.push(result.value); else { failed++; state.mineError = result.reason.message; } }
    state.page++;
    state.records.sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));
    if(failed) state.mineError = `${failed} 份记录未能读取。${state.mineError} 可点击刷新重试。`;
  } catch(error) { state.mineError = error.message; }
}
async function loadShared() {
  state.sharedError='';
  try { state.posts=await service.published(); }
  catch(error) { state.posts=[]; state.sharedError=`暂时无法读取组内总结：${error.message}`; }
}
async function chooseFile(file) {
  if (!file || state.busy) return;
  try {
    if(file.size > 512*1024) throw new Error('文件超过 512 KB，请精简内容后再提交。');
    const content = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
    validateUpload(file.name,content,file.size);
    state.file={name:file.name,size:file.size,content}; state.title=titleFromMarkdown(content,file.name); state.error=''; state.pending=null; state.preview=false;
  } catch(error) { state.file=null; state.pending=null; state.error=error instanceof TypeError ? '无法读取文本，请将文件另存为 UTF-8 编码。' : error.message; }
  render();
}
function bind() {
  app.querySelectorAll('a[href="#mine"],a[href="#others"],a[href="#admin"]').forEach(link=>link.addEventListener('click',event=>{
    event.preventDefault();
    if(state.busy) {toast('正在处理，请稍候。');return;}
    state.route=link.hash === '#admin' && state.user.role === 'admin' ? 'admin' : link.hash === '#others' ? 'others' : 'mine';
    history.replaceState(null,'',link.hash);if(state.route === 'admin') {loadMembers();} else {render();}
  }));
  document.querySelector('#member-form')?.addEventListener('submit',connect);
  document.querySelector('#member-edit-form')?.addEventListener('submit',saveMember);
  app.querySelectorAll('[data-toggle-user]').forEach(b=>b.addEventListener('click',()=>toggleMember(b.dataset.toggleUser)));
  app.querySelectorAll('[data-reset-user]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#new-username').value=b.dataset.resetUser;document.querySelector('#new-password').focus();toast('填写新密码并保存，即可重置该学生密码。');}));
  document.querySelector('#file-input')?.addEventListener('change',event=>chooseFile(event.target.files[0]));
  const drop = document.querySelector('#dropzone');
  drop?.addEventListener('keydown',event=>{if(event.key === 'Enter' || event.key === ' ') {event.preventDefault(); document.querySelector('#file-input').click();}});
  drop?.addEventListener('dragover',event=>{event.preventDefault(); drop.classList.add('dragging');});
  drop?.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
  drop?.addEventListener('drop',event=>{event.preventDefault(); if(event.dataTransfer.files.length !== 1) {toast('请一次选择一份 Markdown 文件。');return;} chooseFile(event.dataTransfer.files[0]);});
  document.querySelector('#report-title')?.addEventListener('input',event=>{state.title=event.target.value;state.pending=null;});
  document.querySelector('#report-week')?.addEventListener('input',event=>{state.week=event.target.value;state.pending=null;});
  document.querySelector('#upload-form')?.addEventListener('submit',submit);
  app.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.action)));
  app.querySelectorAll('[data-record]').forEach(button=>button.addEventListener('click',()=>openRecord(Number(button.dataset.record))));
  app.querySelectorAll('[data-post]').forEach(button=>button.addEventListener('click',()=>openPost(Number(button.dataset.post))));
}
async function enter(user) {
  Object.assign(state,{user:{...user,login:user.username},route:'mine',sharedError:'',mineError:'',error:''});
  await loadMine();await loadShared();history.replaceState(null,'','#mine');
}
async function connect(event) {
  event.preventDefault();if(state.busy) return;
  const name=document.querySelector('#username').value.trim();
  const password=document.querySelector('#password').value;document.querySelector('#password').value='';
  state.busy=true;state.error='';render();
  try {await enter(await service.login(name,password));}
  catch(error) {state.user=null;state.error=error.message;}
  finally {state.busy=false;render();}
}
function adminPage() {
  if(state.user.role !== 'admin') return '';
  return `<div class="page-heading"><div><div class="eyebrow">MEMBERS</div><h1>成员管理<span class="heading-dot">.</span></h1><p>由你创建账号，再把用户名和初始密码分别交给学生。</p></div></div><section class="panel admin-panel"><h2>添加学生 / 重置密码</h2><form id="member-edit-form"><div class="form-row"><div class="field"><label for="new-username">用户名</label><input id="new-username" required pattern="[a-z][a-z0-9_-]{1,31}" placeholder="例如 zhangsan" autocomplete="off"></div><div class="field"><label for="new-name">展示姓名（新账号）</label><input id="new-name" maxlength="60" placeholder="例如 张三"></div></div><label for="new-password">初始密码 / 新密码</label><input id="new-password" type="password" minlength="12" maxlength="128" required autocomplete="new-password" placeholder="至少 12 个字符，请自行保管并分发"><p class="form-note">填写已有用户名会重置该学生密码，并让原登录失效。不会显示或恢复旧密码。</p>${errorBox(state.error)}<button class="button primary" ${state.busy ? 'disabled' : ''}>${state.busy ? '正在保存…' : '保存学生账号'}</button></form></section><section class="history-section"><div class="section-heading"><h2>已创建的账号</h2><button class="button text-button" data-action="members">刷新名单</button></div><div class="record-list">${(state.members || []).map(u=>`<div class="record-row"><span class="avatar">${e(Array.from(u.name)[0])}</span><span class="record-copy"><strong>${e(u.name)}</strong><small>${e(u.username)} · ${u.role === 'admin' ? '管理员' : u.active ? '学生 · 已启用' : '学生 · 已停用'}</small></span>${u.role === 'student' ? `<button class="button text-button" data-reset-user="${e(u.username)}">重置密码</button><button class="button secondary" data-toggle-user="${e(u.username)}">${u.active ? '停用' : '启用'}</button>` : ''}</div>`).join('')}</div></section>`;
}
async function loadMembers() {
  if(state.user.role !== 'admin') return;
  state.busy=true;state.error='';render();
  try {state.members=await service.request('/api/admin/users');}
  catch(error) {state.error=error.message;}
  finally {state.busy=false;render();}
}
async function saveMember(event) {
  event.preventDefault();if(state.busy) return;
  const body={username:document.querySelector('#new-username').value.trim(),name:document.querySelector('#new-name').value.trim(),password:document.querySelector('#new-password').value};
  document.querySelector('#new-password').value='';state.busy=true;state.error='';render();
  try {await service.request('/api/admin/users',body);state.members=await service.request('/api/admin/users');toast('学生账号已保存。请将你设置的用户名和密码交给对应学生。');}
  catch(error) {state.error=error.message;}
  finally {body.password='';state.busy=false;render();}
}
async function toggleMember(name) {
  if(state.busy) return;state.busy=true;state.error='';
  try {await service.request('/api/admin/users',{username:name,action:'toggle'});state.members=await service.request('/api/admin/users');}
  catch(error) {state.error=error.message;}
  finally {state.busy=false;render();}
}
async function submit(event) {
  event.preventDefault(); if(state.busy || !state.file) return;
  try {
    state.pending ||= makeReport({user:state.user,title:state.title,week:state.week,filename:state.file.name,content:state.file.content});
    state.busy=true;state.error='';render();
    await service.submit(state.pending);
    state.file=null;state.title='';state.pending=null;state.preview=false;
    await loadMine(); toast('提交成功，原稿已保存。');
  } catch(error) {state.error=error.message;}
  finally {state.busy=false;render();}
}
function openRecord(index) {
  if(state.busy) return;
  state.reading=state.records[index];state.readFrom='mine';state.route='read';render();window.scrollTo(0,0);document.querySelector('#main').focus();
}
async function openPost(index) {
  if(state.busy) return;
  const post=state.posts[index];state.busy=true;
  try {
    const content=await service.file(post.path);
    state.reading={...post,content};state.readFrom='others';state.route='read';render();window.scrollTo(0,0);document.querySelector('#main').focus();
  } catch(error) {toast(error.message);}
  finally {state.busy=false;document.querySelector('#main')?.setAttribute('aria-busy','false');}
}
async function action(name) {
  if(state.busy) {toast('正在处理，请稍候。');return;}
  if(name === 'logout') {try {await service.logout();} catch(error) {toast(error.message);}state={user:null,route:'mine',file:null,title:'',week:currentWeek(),records:[],posts:[],files:[],page:0,busy:false,preview:false,error:'',mineError:'',sharedError:'',pending:null};history.replaceState(null,'',location.pathname);render();return;}
  if(name === 'members') {await loadMembers();return;}
  if(name === 'template') {download(weeklyTemplate,'每周思考模板.md');return;}
  if(name === 'preview') {state.preview=!state.preview;render();return;}
  if(name === 'back') {state.route=state.readFrom;render();return;}
  if(name === 'download') {download(state.reading.content,state.reading.filename || `${state.reading.title}.md`);return;}
  if(name === 'refresh' || name === 'more') {
    state.busy=true;
    if(state.route === 'others') {await loadShared();} else {await loadMine(name !== 'more');}
    state.busy=false;render();
  }
}
window.addEventListener('hashchange',()=>{if(!state.user || state.busy) return;state.route=location.hash === '#admin' && state.user.role === 'admin' ? 'admin' : location.hash === '#others' ? 'others' : 'mine';if(state.route === 'admin') loadMembers();else render();});
window.addEventListener('beforeunload',event=>{if(state.file || state.busy) {event.preventDefault();event.returnValue='';}});
render();
