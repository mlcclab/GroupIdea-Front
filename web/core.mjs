import { marked, Renderer } from './vendor/marked.esm.js';

export const MAX_BYTES = 512 * 1024;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export function safeLink(value) {
  const href = String(value || '').trim();
  if (href.startsWith('#')) return href;
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(href).protocol) ? href : null; }
  catch { return null; }
}
const renderer = new Renderer();
// Disable raw HTML and remote images. Markdown cannot execute scripts or request tracking images.
renderer.html = ({ text }) => escapeHTML(text);
renderer.link = function({ href, tokens }) {
  const label = this.parser.parseInline(tokens);
  const safe = safeLink(href);
  return safe ? `<a href="${escapeHTML(safe)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${label}</a>` : label;
};
renderer.image = ({ text }) => `<span class="image-note">[图片：${escapeHTML(text || '未命名')}；此版本不加载图片]</span>`;
export const renderMarkdown = text => marked.parse(String(text), { renderer, gfm: true, breaks: false });

export function encode64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function decode64(text) {
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));
}
export function currentWeek(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  const day = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export function validWeek(week) {
  if (!/^20\d{2}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(week)) return false;
  const year = +week.slice(0,4), n = +week.slice(-2);
  const last = currentWeek(new Date(Date.UTC(year,11,28)));
  return n <= +last.slice(-2);
}
export function titleFromMarkdown(content, filename) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s+#+$/, '').trim();
  return (heading || filename.replace(/\.(md|markdown)$/i, '') || '每周思考').slice(0,100);
}
export function validateUpload(filename, text, byteSize = new TextEncoder().encode(text).length) {
  if (!/\.(md|markdown)$/i.test(filename)) throw new Error('请选择 .md 或 .markdown 文件。');
  if (byteSize > MAX_BYTES) throw new Error('文件超过 512 KB，请精简内容后再提交。');
  if (!text.trim()) throw new Error('文件内容为空，请写下你的思考后再提交。');
  if (text.includes('\u0000')) throw new Error('文件不是有效的 Markdown 文本，请另存为 UTF-8 编码。');
}
export function repoName(value) {
  const name = String(value || '').trim().replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
  if (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?\/[a-z\d_.-]+$/i.test(name) || name.endsWith('/..') || name.endsWith('/.')) throw new Error('仓库格式应为 所有者/仓库名，例如 mlcclab/GroupIdea。');
  return name;
}
export function contentPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || /[\\\x00-\x1f]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('文件路径无效。');
  return path.split('/').map(encodeURIComponent).join('/');
}
export function validDate(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.toISOString().slice(0,10) === value;
}
export function currentDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function makeReport({user, title, recordDate, week, filename, content}, now = new Date(), id = crypto.randomUUID()) {
  validateUpload(filename, content);
  if (!title.trim() || title.trim().length > 100) throw new Error('请填写 1–100 字的标题。');
  if (recordDate ? !validDate(recordDate) : (week ? !validWeek(week) : false)) throw new Error(recordDate ? '请选择有效的记录日期。' : '请选择有效的报告周，例如 2026-W37。');
  if (!Number.isSafeInteger(user.id) || user.id < 1 || !/^[a-z\d_-]+$/i.test(user.login)) throw new Error('用户身份无效，请重新登录。');
  return {version:1, id, title:title.trim(), ...(recordDate ? {recordDate} : week ? {week} : {recordDate:currentDate(now)}), filename, author:user.login, authorId:user.id, displayName:user.name || user.login, role:user.role, submittedAt:now.toISOString(), content};
}
export function reportPath(report) {
  const stamp = report.submittedAt.replace(/[:.]/g,'');
  return `submissions/${report.authorId}/${report.recordDate || report.week}__${stamp}__${report.id}.md`;
}
export function packReport(report) {
  const {content, ...metadata} = report;
  return `<!-- groupidea-v1:${encode64(JSON.stringify(metadata))} -->\n${content}`;
}
export function unpackReport(text) {
  const match = text.match(/^<!-- groupidea-v1:([A-Za-z\d+/=]+) -->\n/);
  if (!match) throw new Error('这不是 GroupIdea 提交记录。');
  const meta = JSON.parse(decode64(match[1]));
  const content = text.slice(match[0].length);
  if (meta.version !== 1 || typeof meta.title !== 'string' || typeof meta.author !== 'string' || !Number.isSafeInteger(meta.authorId) || (!meta.recordDate && !validWeek(meta.week)) || (meta.recordDate && !validDate(meta.recordDate)) || !Number.isFinite(Date.parse(meta.submittedAt)) || typeof meta.filename !== 'string') throw new Error('提交记录的信息不完整。');
  return {...meta, role: meta.role, content};
}
export function validateIndex(index) {
  if (index?.version !== 1 || !Array.isArray(index.posts)) throw new Error('总结索引格式不正确，请管理员重新生成。');
  if (index.posts.length > 1000) throw new Error('总结超过初版的 1000 篇上限，请按年度归档。');
  const paths = new Set();
  for (const p of index.posts) {
    if (!p || ['title','author','publishedAt','path'].some(k => typeof p[k] !== 'string' || !p[k].trim()) || !Number.isFinite(Date.parse(p.publishedAt))) throw new Error('总结索引缺少标题、作者、时间或路径。');
    contentPath(p.path);
    if (!p.path.startsWith('published/') || !p.path.endsWith('.md') || paths.has(p.path)) throw new Error('总结路径必须唯一，并位于 published 目录。');
    if (p.week != null && !validWeek(p.week)) throw new Error('总结的报告周无效。');
    paths.add(p.path);
  }
  return [...index.posts].sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
export const dateLabel = value => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
export const weekLabel = week => `${week.slice(0,4)} 年 · 第 ${Number(week.slice(-2))} 周`;
export const roleLabel = role => ({admin:'PI', pi:'PI', graduate:'研究生', student:'研究生', postdoc:'博士后'}[role] || '成员');
export const displayAuthor = item => `${item.displayName || item.author || '未署名'}（${roleLabel(item.role)}）`;
