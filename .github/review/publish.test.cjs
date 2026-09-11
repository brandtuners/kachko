const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseReport, renderReport, publishReview } = require('./publish.cjs');
const pr = { number: 4, state: 'open', head: { sha: 'a'.repeat(40) }, base: { sha: 'b'.repeat(40) } };
const pass = { status: 'pass', head_sha: pr.head.sha, base_sha: pr.base.sha,
  summary: 'Reviewed relevant changes.', verification: 'Static review; tests not run.', findings: [], limitations: [] };
const finding = { priority: 'P1', title: 'Missing ownership', path: 'apps/api/src/pages.ts', line: 10,
  doc_path: 'docs/02-LLD.md', doc_line: 100, doc_section: 'Authorization',
  impact: 'Another user can edit the page.', correction: 'Check the authenticated owner.' };
function harness(raw = JSON.stringify(pass), result = 'success', current = pr, comments = []) {
  const writes = []; const outputs = {};
  const github = { paginate: async () => comments, rest: {
    pulls: { get: async () => ({ data: current }) },
    issues: { listComments: () => {}, createComment: async value => writes.push(value), updateComment: async value => writes.push(value) }
  } };
  const context = { repo: { owner: 'brandtuners', repo: 'kachko' }, payload: { pull_request: pr } };
  const core = { setOutput: (k, v) => { outputs[k] = v; }, info() {}, warning() {} };
  return { run: () => publishReview({ github, context, core, raw, result }), writes, outputs, github };
}
test('rejects stale and contradictory reports', () => {
  assert.throws(() => parseReport(JSON.stringify({ ...pass, head_sha: 'c'.repeat(40) }), pr));
  assert.throws(() => parseReport(JSON.stringify({ ...pass, findings: [finding] }), pr));
  assert.throws(() => parseReport(JSON.stringify({ ...pass, status: 'fail' }), pr));
});
test('findings require a project document citation', () => {
  assert.throws(() => parseReport(JSON.stringify({ ...pass, status: 'fail', findings: [{ ...finding, doc_path: 'random.md' }] }), pr));
});
test('renders commit-specific evidence and neutralizes mentions', () => {
  const body = renderReport({ ...pass, status: 'fail', findings: [{ ...finding, title: '@team <script>' }] }, { owner: 'brandtuners', repo: 'kachko' });
  assert.ok(body.includes(`/blob/${pr.head.sha}/apps/api/src/pages.ts#L10`));
  assert.ok(body.includes(`/blob/${pr.base.sha}/docs/02-LLD.md#L100`));
  assert.ok(!body.includes('@team')); assert.ok(!body.includes('<script>'));
});
test('publishes findings and exposes a failing verdict', async () => {
  const h = harness(JSON.stringify({ ...pass, status: 'fail', findings: [finding] }));
  await h.run(); assert.equal(h.writes.length, 1); assert.equal(h.outputs.verdict, 'fail');
});
test('failed job and malformed output never pass', async () => {
  for (const [raw, result] of [['bad json', 'success'], [JSON.stringify(pass), 'failure']]) {
    const h = harness(raw, result); await h.run(); assert.equal(h.outputs.verdict, 'incomplete');
    assert.match(h.writes[0].body, /Review incomplete/);
  }
});
test('does not publish on closed or changed PRs', async () => {
  for (const current of [{ ...pr, state: 'closed' }, { ...pr, head: { sha: 'new' } }]) {
    const h = harness(JSON.stringify(pass), 'success', current); await h.run();
    assert.equal(h.writes.length, 0); assert.equal(h.outputs.verdict, 'incomplete');
  }
});
test('updates its bot comment and leaves human comments alone', async () => {
  const comments = [{ id: 1, body: '<!-- kachko-docs-review -->old', user: { login: 'github-actions[bot]', type: 'Bot' } },
    { id: 2, body: '<!-- kachko-docs-review -->human', user: { login: 'rohan', type: 'User' } }];
  const h = harness(JSON.stringify(pass), 'success', pr, comments); await h.run();
  assert.equal(h.writes[0].comment_id, 1); assert.equal(h.outputs.verdict, 'pass');
});
test('does not duplicate an identical comment', async () => {
  const body = renderReport(pass, { owner: 'brandtuners', repo: 'kachko' });
  const h = harness(JSON.stringify(pass), 'success', pr, [{ id: 1, body, user: { login: 'github-actions[bot]', type: 'Bot' } }]);
  await h.run(); assert.equal(h.writes.length, 0); assert.equal(h.outputs.verdict, 'pass');
});
test('rechecks the head before posting', async () => {
  const h = harness(); let calls = 0;
  h.github.rest.pulls.get = async () => ({ data: ++calls === 1 ? pr : { ...pr, head: { sha: 'new' } } });
  await h.run(); assert.equal(h.writes.length, 0); assert.equal(h.outputs.verdict, 'incomplete');
});
