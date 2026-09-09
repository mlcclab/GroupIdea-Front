import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GroupIdeaService} from '../web/service.mjs';

test('member login authorizes Worker uploads without accepting client author or repository fields', async t => {
  globalThis.window = {GROUPIDEA_CONFIG: {apiBase: 'https://api.example/'}};
  t.after(() => {delete globalThis.window;});
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url, options});
    return Response.json(url.endsWith('/api/login')
      ? {user: {id: 42, username: 'student'}, token: 'session-test'}
      : {path: 'submissions/42/report.md'});
  });
  const service = new GroupIdeaService();
  assert.equal((await service.login('student', 'test-password')).id, 42);
  const report = {id: 'id', title: '思考', week: '2026-W37', filename: 'a.md', content: '# 原稿'};
  await service.submit({...report, authorId: 99, repo: 'other/repo'});
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].url, 'https://api.example/api/reports');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer session-test');
  assert.deepEqual(JSON.parse(calls[1].options.body), report);
  assert.equal(calls[1].options.redirect, 'error');
  assert.equal(new GroupIdeaService().accessToken, '');
});

test('logout clears the local session even if the Worker is unavailable', async t => {
  globalThis.window = {GROUPIDEA_CONFIG: {apiBase: 'https://api.example'}};
  t.after(() => {delete globalThis.window;});
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('offline');});
  const service = new GroupIdeaService();
  service.accessToken = 'session-test';
  await assert.rejects(service.logout(), /无法连接/);
  assert.equal(service.accessToken, '');
});
