import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

describe('project structure', () => {
  it('keeps frontend and backend code in separate top-level folders', async () => {
    const frontend = await stat(path.join(repoRoot, 'frontend'));
    const backend = await stat(path.join(repoRoot, 'backend'));

    assert.equal(frontend.isDirectory(), true);
    assert.equal(backend.isDirectory(), true);
  });

  it('loads the UI through external frontend assets instead of inline app code', async () => {
    const html = await readProjectFile('frontend/index.html');

    assert.match(html, /src="\.\/src\/data\/mockSkills\.js"/);
    assert.match(html, /src="\.\/src\/data\/mockFileContents\.js"/);
    assert.match(html, /src="\.\/src\/app\.js"/);
    assert.match(html, /href="\.\/src\/styles\.css"/);
    assert.doesNotMatch(html, /const MOCK_SKILLS = \[/);
    assert.doesNotMatch(html, /function renderSkillCards/);
  });

  it('exposes stable backend API placeholders for the future app', async () => {
    const server = await readProjectFile('backend/server.js');

    assert.match(server, /GET \/api\/health/);
    assert.match(server, /GET \/api\/skills/);
    assert.match(server, /frontend\/index\.html/);
  });
});
