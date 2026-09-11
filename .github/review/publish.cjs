const MARKER = '<!-- kachko-docs-review -->';
const DOCS = new Set(['docs/01-HLD.md', 'docs/02-LLD.md', 'docs/03-DEVELOPMENT-BLUEPRINT.md']);
const text = value => String(value).replaceAll('@', '@\u200b').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const validText = value => typeof value === 'string' && value.trim().length > 0;

function parseReport(raw, pr) {
  if (typeof raw !== 'string' || raw.length > 40000) throw new Error('Missing or oversized report');
  const report = JSON.parse(raw);
  if (!report || report.head_sha !== pr.head.sha || report.base_sha !== pr.base.sha) throw new Error('Report commit mismatch');
  if (!['pass', 'fail', 'incomplete'].includes(report.status)) throw new Error('Invalid verdict');
  if (!validText(report.summary) || !validText(report.verification)) throw new Error('Missing review evidence');
  if (!Array.isArray(report.limitations) || !report.limitations.every(validText) || !Array.isArray(report.findings)) throw new Error('Invalid findings or limitations');
  if (report.status === 'pass' && report.findings.length) throw new Error('Passing report contains findings');
  if (report.status === 'fail' && !report.findings.length) throw new Error('Failing report has no findings');
  for (const f of report.findings) {
    if (!f || !['P0', 'P1', 'P2', 'P3'].includes(f.priority) ||
        !['title', 'path', 'doc_path', 'doc_section', 'impact', 'correction'].every(k => validText(f[k])) ||
        !Number.isSafeInteger(f.line) || f.line < 1 || !Number.isSafeInteger(f.doc_line) || f.doc_line < 1 ||
        !DOCS.has(f.doc_path) || f.path.startsWith('/') || f.path.split('/').includes('..')) {
      throw new Error('Finding lacks a valid code/document reference');
    }
  }
  return report;
}

function renderReport(report, repo) {
  const root = `https://github.com/${repo.owner}/${repo.repo}`;
  const link = (sha, path, line) => `${root}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}#L${line}`;
  const verdict = { pass: 'No findings in reviewed scope', fail: 'Unmet requirements', incomplete: 'Review incomplete' }[report.status];
  const sections = [MARKER, '## kachko documentation review',
    `Reviewed commit: [${report.head_sha.slice(0, 12)}](${root}/commit/${report.head_sha})`,
    `Documentation baseline: [${report.base_sha.slice(0, 12)}](${root}/commit/${report.base_sha})`,
    `**Verdict: ${verdict}**`, text(report.summary)];
  for (const [i, f] of report.findings.entries()) {
    sections.push(`### ${i + 1}. [${f.priority}] ${text(f.title)}`,
      `Code: [view line ${f.line}](${link(report.head_sha, f.path, f.line)})`,
      `Requirement: [${text(f.doc_section)}](${link(report.base_sha, f.doc_path, f.doc_line)})`,
      `Impact/evidence: ${text(f.impact)}`, `Required correction: ${text(f.correction)}`);
  }
  sections.push('### Verification', text(report.verification));
  if (report.limitations.length) sections.push('### Limitations', ...report.limitations.map(l => `- ${text(l)}`));
  sections.push(report.status === 'pass'
    ? 'No actionable documentation violations found in this review. Separate CI and human review still apply.'
    : 'Address the findings or review failure and rerun this check before merging.');
  const body = sections.join('\n\n');
  if (body.length > 60000) throw new Error('Rendered report is too large');
  return body;
}

async function publishReview({ github, context, core, raw, result }) {
  const expected = context.payload.pull_request;
  const args = { ...context.repo, pull_number: expected.number };
  const current = (await github.rest.pulls.get(args)).data;
  if (current.state !== 'open' || current.head.sha !== expected.head.sha || current.base.sha !== expected.base.sha) {
    core.setOutput('verdict', 'incomplete');
    core.warning('PR changed or closed; refusing to publish a stale review.');
    return;
  }
  let report;
  try {
    if (result !== 'success') throw new Error('Review job did not succeed');
    report = parseReport(raw, expected);
  } catch {
    report = { status: 'incomplete', head_sha: expected.head.sha, base_sha: expected.base.sha,
      summary: 'The automated review could not produce a complete validated report.', findings: [],
      verification: 'No successful review is claimed. Inspect the workflow logs, configuration and OPENAI_API_KEY secret, then rerun.',
      limitations: ['Review execution or output validation failed.'] };
  }
  const body = renderReport(report, context.repo);
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo, issue_number: expected.number, per_page: 100
  });
  const previous = comments.filter(c => c.user?.login === 'github-actions[bot]' && c.user?.type === 'Bot' && c.body?.startsWith(MARKER)).at(-1);
  // Recheck immediately before the mutation; GitHub issue comments have no conditional-SHA write API.
  const latest = (await github.rest.pulls.get(args)).data;
  if (latest.state !== 'open' || latest.head.sha !== expected.head.sha || latest.base.sha !== expected.base.sha) {
    core.setOutput('verdict', 'incomplete');
    core.warning('PR changed while preparing feedback; review will need another run.');
    return;
  }
  if (previous && previous.body === body) {
    core.info(`Existing review: ${previous.html_url}`);
  } else if (previous) {
    await github.rest.issues.updateComment({ ...context.repo, comment_id: previous.id, body });
  } else {
    await github.rest.issues.createComment({ ...context.repo, issue_number: expected.number, body });
  }
  core.setOutput('verdict', report.status);
}
module.exports = { parseReport, renderReport, publishReview };
