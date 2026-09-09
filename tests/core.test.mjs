import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown, safeLink, encode64, decode64, currentWeek, validWeek, validateUpload, makeReport, packReport, unpackReport, reportPath, repoName, contentPath, validateIndex} from '../web/core.mjs';

const user={id:42,login:'student-a',name:'同学甲'};
const sample=()=>makeReport({user,title:'测试报告',week:'2026-W37',filename:'原稿.md',content:'# 中文思考\r\n\r\n保留原文 😀\r\n'},new Date('2026-09-09T03:00:00Z'),'fixed-id');
test('UTF-8 encode/decode preserves Chinese, emoji and original CRLF',()=>{
  const text=sample().content;assert.equal(decode64(encode64(text)),text);
  assert.equal(unpackReport(packReport(sample())).content,text);
});
test('report metadata and path bind to numeric member identity',()=>{
  const r=sample();assert.deepEqual(unpackReport(packReport(r)),r);
  assert.equal(reportPath(r),'submissions/42/2026-W37__2026-09-09T030000000Z__fixed-id.md');
});
test('invalid uploads and report fields rejected',()=>{
  assert.throws(()=>validateUpload('payload.html','# x'));
  assert.throws(()=>validateUpload('empty.md','   '));
  assert.throws(()=>validateUpload('large.md','x',524289));
  assert.throws(()=>validateUpload('binary.md','a\0b'));
  assert.throws(()=>makeReport({user,title:'',week:'2026-W37',filename:'a.md',content:'x'}));
  assert.throws(()=>makeReport({user:{...user,id:'../x'},title:'x',week:'2026-W37',filename:'a.md',content:'x'}));
});
test('Shanghai ISO week handles year boundary and invalid week 53',()=>{
  assert.equal(currentWeek(new Date('2025-12-28T16:00:00Z')),'2026-W01');
  assert.equal(currentWeek(new Date('2026-09-09T03:00:00Z')),'2026-W37');
  assert.equal(validWeek('2026-W53'),true);assert.equal(validWeek('2025-W53'),false);
  assert.equal(validWeek('2026-W00'),false);
});
test('repository names and file paths cannot change API origin',()=>{
  assert.equal(repoName('https://github.com/mlcclab/GroupIdea.git'),'mlcclab/GroupIdea');
  for(const name of ['evil.com/repo?q=x','https://evil.com/foo','x/y/z','x/..']) assert.throws(()=>repoName(name));
  for(const path of ['/x','../x','x/../y','x\\y','x//y','x\0y']) assert.throws(()=>contentPath(path));
  assert.equal(contentPath('published/中文.md'),'published/%E4%B8%AD%E6%96%87.md');
});
test('Markdown renders GFM while disabling raw HTML, unsafe links and image requests',()=>{
  const html=renderMarkdown('# 标题\n\n<script>alert(1)</script>\n\n[x](javascript:alert%281%29)\n\n![外部](https://tracker.example/a)\n\n[安全](https://example.com)\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.match(html,/<h1>标题<\/h1>/);assert.match(html,/<table>/);assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script|<img|href="javascript:/i);assert.match(html,/rel="noopener noreferrer"/);
  for(const href of ['javascript:alert(1)','java\nscript:alert(1)','data:text/html,x','//evil.example/a','file:///etc/passwd']) assert.equal(safeLink(href),null);
});
test('Markdown attributes cannot break out of a safe link',()=>{
  const html=renderMarkdown('[hi](<https://example.com/"onclick="evil>)\n\n<svg onload=alert(1)>');
  assert.doesNotMatch(html,/<svg|"onclick="evil/);assert.match(html,/&lt;svg/);
});
test('published index rejects missing metadata, traversal and duplicate paths',()=>{
  const post={title:'题目',author:'张三',publishedAt:'2026-09-09T00:00:00Z',path:'published/a.md',week:'2026-W37'};
  assert.equal(validateIndex({version:1,posts:[post]}).length,1);
  for(const p of [{...post,path:'submissions/a.md'},{...post,path:'published/../a.md'},{...post,publishedAt:'yesterday'},{...post,title:''}]) assert.throws(()=>validateIndex({version:1,posts:[p]}));
  assert.throws(()=>validateIndex({version:1,posts:[post,post]}));
});
