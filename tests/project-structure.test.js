import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

async function readBackendSkills() {
  const { readSkillCatalog } = await import('../backend/lib/skillCatalog.js');

  return readSkillCatalog();
}

async function readBackendOfficialSkills() {
  return (await readBackendSkills()).filter((skill) => skill.source_path.startsWith('official/'));
}

async function readFrontendSkills() {
  const source = await readProjectFile('frontend/src/data/mockSkills.js');
  const sandbox = { window: {} };

  vm.runInNewContext(source, sandbox);

  return sandbox.window.MOCK_SKILLS;
}

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

  it('lets only the brand mark return to the marketplace home view and clear filters', async () => {
    const html = await readProjectFile('frontend/index.html');
    const app = await readProjectFile('frontend/src/app.js');

    assert.match(html, /<button type="button" onclick="returnToMarketplaceHome\(\)"[^>]*aria-label="마켓플레이스 초기 화면으로 이동"[\s\S]*POSCO Enterprise Portal[\s\S]*AI Skill MarketPlace[\s\S]*<\/button>/);
    assert.match(html, /<button onclick="switchView\('marketplace'\)" id="nav-marketplace"/);
    assert.match(app, /function returnToMarketplaceHome\(\)\s*{[\s\S]*resetFilters\(\)/);
    assert.match(app, /function returnToMarketplaceHome\(\)\s*{[\s\S]*switchView\('marketplace'\)/);
  });

  it('loads skill cards from the backend API with a frontend fallback only', async () => {
    const app = await readProjectFile('frontend/src/app.js');

    assert.match(app, /fetch\(['"]\/api\/skills['"]\)/);
    assert.match(app, /method:\s*['"]POST['"]/);
    assert.match(app, /loadSkillCatalog/);
    assert.match(app, /MOCK_SKILLS/);
  });

  it('exposes editable skill file controls only through the detail workspace', async () => {
    const app = await readProjectFile('frontend/src/app.js');
    const html = await readProjectFile('frontend/index.html');

    assert.match(html, /id="btn-edit-skill-meta"/);
    assert.match(html, /id="skill-meta-editor"/);
    assert.match(html, /id="skill-meta-name"/);
    assert.match(html, /id="skill-meta-short-description"/);
    assert.match(html, /id="btn-edit-file"/);
    assert.match(html, /id="btn-save-file"/);
    assert.doesNotMatch(html, /id="editor-mode-label"/);
    assert.doesNotMatch(app, /VIEW MODE:/);
    assert.match(html, /id="nav-admin-mode"/);
    assert.match(html, /id="nav-admin-mode"[^>]*aria-label="관리자 모드"[^>]*h-8 w-8/);
    assert.match(html, /id="admin-modal"/);
    assert.match(html, /id="admin-password-input"/);
    assert.match(html, /openAdminMode\(\)/);
    assert.match(html, /submitAdminMode\(event\)/);
    assert.match(app, /const ADMIN_ACCESS_PASSWORD = '1'/);
    assert.match(app, /let isAdminMode = sessionStorage\.getItem\(ADMIN_MODE_STORAGE_KEY\) === 'true'/);
    assert.match(app, /function openAdminMode\(\)/);
    assert.match(app, /function closeAdminModal\(\)/);
    assert.match(app, /function submitAdminMode\(event\)/);
    assert.doesNotMatch(app, /window\.prompt|prompt\(/);
    assert.doesNotMatch(app, /Admin ON/);
    assert.match(app, /button\.setAttribute\('aria-pressed', String\(isAdminMode\)\)/);
    assert.match(app, /if \(isAdminMode\) return true/);
    assert.match(app, /adminPassword: isAdminMode \? ADMIN_ACCESS_PASSWORD : undefined/);
    assert.match(app, /function canCurrentAccountEditSkill\(skill\)/);
    assert.match(app, /function openSkillMetaEditor\(\)/);
    assert.match(app, /function closeSkillMetaEditor\(\)/);
    assert.match(app, /function saveSkillMetaEdit\(event\)/);
    assert.match(app, /const \{ file_contents, files, source_path, has_manifest, \.\.\.manifest \} = skill/);
    assert.match(app, /return JSON\.parse\(manifestContent\)/);
    assert.match(app, /filePath:\s*'skill\.json'/);
    assert.match(app, /function startFileEdit\(\)/);
    assert.match(app, /function saveFileEdit\(\)/);
    assert.match(app, /fetch\(`\/api\/skills\/\$\{encodeURIComponent\(activeSkillId\)\}\/files`/);
  });

  it('lets markdown files switch between rendered preview and raw source views', async () => {
    const app = await readProjectFile('frontend/src/app.js');
    const html = await readProjectFile('frontend/index.html');

    assert.match(html, /id="markdown-view-toggle"/);
    assert.match(html, /setMarkdownViewMode\('rendered'\)/);
    assert.match(html, /setMarkdownViewMode\('source'\)/);
    assert.match(app, /let markdownViewMode = readMarkdownViewMode\(\)/);
    assert.match(app, /return \['rendered', 'source'\]\.includes\(savedMode\) \? savedMode : 'rendered'/);
    assert.match(app, /function isMarkdownFile\(filePath\)/);
    assert.match(app, /function setMarkdownViewMode\(mode\)/);
    assert.match(app, /currentFilePath,\s*currentFileContent/);
    assert.match(app, /markdown-source-view/);
  });

  it('remembers the last markdown view mode across detail file changes', async () => {
    const app = await readProjectFile('frontend/src/app.js');

    assert.match(app, /MARKDOWN_VIEW_MODE_STORAGE_KEY/);
    assert.match(app, /function readMarkdownViewMode\(\)/);
    assert.match(app, /let markdownViewMode = readMarkdownViewMode\(\)/);
    assert.match(app, /sessionStorage\.setItem\(MARKDOWN_VIEW_MODE_STORAGE_KEY,\s*mode\)/);

    const loadWorkspaceBody = app.match(/function loadWorkspaceFileByPath\(filePath\) \{[\s\S]*?\n        \}/)?.[0] || '';
    assert.doesNotMatch(loadWorkspaceBody, /markdownViewMode\s*=\s*'rendered'/);
  });

  it('anchors the full file-mode control group to the right', async () => {
    const html = await readProjectFile('frontend/index.html');

    assert.match(html, /<div class="ml-auto flex items-center gap-2 py-1">[\s\S]*id="btn-edit-file"[\s\S]*<div id="markdown-view-toggle"/);
    assert.doesNotMatch(html, /<div class="ml-auto flex min-w-0 flex-1 items-center gap-2 py-1">/);
    assert.doesNotMatch(html, /id="markdown-view-toggle" class="[^"]*\bml-auto\b/);
    assert.doesNotMatch(html, /editor-mode-label/);
  });

  it('lets card tag pills filter the catalog and restores filters with browser back', async () => {
    const app = await readProjectFile('frontend/src/app.js');
    const html = await readProjectFile('frontend/index.html');

    assert.match(app, /tag:\s*''/);
    assert.match(app, /function setTagFilter\(tag\)/);
    assert.match(app, /item\.tags\.includes\(activeFilters\.tag\)/);
    assert.match(app, /onclick="setTagFilter\('\$\{escapeJsString\(tag\)\}'\)"/);
    assert.match(app, /window\.addEventListener\('popstate',\s*handleCatalogHistoryNavigation\)/);
    assert.match(app, /history\.pushState\(createCatalogHistoryState\(\),\s*'',\s*createCatalogUrl\(\)\)/);
    assert.match(app, /function createDetailHistoryState\(skillId\)/);
    assert.match(app, /detail:\s*\{\s*skillId\s*\}/);
    assert.match(app, /function pushDetailHistory\(skillId\)/);
    assert.match(app, /history\.pushState\(createDetailHistoryState\(skillId\),\s*'',\s*createCatalogUrl\(\)\)/);
    assert.match(app, /function navigateBackToCatalog\(\)/);
    assert.match(app, /history\.state\?\.detail[\s\S]*history\.back\(\)/);
    assert.match(app, /detailState\?\.skillId[\s\S]*switchView\('detail'\)/);
    assert.match(app, /switchView\('marketplace'\)/);
    assert.match(app, /loadSkillDetail\(skillId\);[\s\S]*pushDetailHistory\(skillId\);[\s\S]*switchView\('detail'\)/);
    assert.match(html, /onclick="navigateBackToCatalog\(\)"/);
  });

  it('keeps the detail file viewer in a stable internal scroll layout', async () => {
    const html = await readProjectFile('frontend/index.html');
    const app = await readProjectFile('frontend/src/app.js');

    assert.match(html, /<body class="[^"]*\bh-screen\b[^"]*\boverflow-hidden\b/);
    assert.match(html, /<main class="[^"]*\bmin-h-0\b[^"]*\boverflow-hidden\b/);
    assert.match(html, /id="view-detail" class="[^"]*\bmin-h-0\b[^"]*\boverflow-hidden\b/);
    assert.match(html, /<div class="detail-workspace flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">/);
    assert.match(html, /<aside class="detail-explorer w-full md:w-64 h-64 md:h-auto min-h-0/);
    assert.match(html, /<main class="detail-document-pane flex-1 min-h-0 flex flex-col bg-white overflow-hidden">/);
    assert.match(html, /class="[^"]*\bmin-h-0\b[^"]*" id="detail-content-area"/);
    const styles = await readProjectFile('frontend/src/styles.css');
    assert.match(styles, /#view-detail\s*{[\s\S]*overflow-y:\s*auto\s*!important;/);
    assert.match(styles, /\.detail-workspace\s*{[\s\S]*flex:\s*none\s*!important;[\s\S]*min-height:\s*max-content\s*!important;/);
    assert.match(styles, /\.detail-explorer\s*{[\s\S]*height:\s*min\(16rem,\s*32dvh\)\s*!important;/);
    assert.match(styles, /#detail-content-area\s*{[\s\S]*min-height:\s*28rem;/);
    assert.doesNotMatch(app, /classList\.(?:add|remove)\([^)]*['"]font-semibold['"]/);
  });

  it('keeps marketplace scrolling scoped to the skill grid', async () => {
    const html = await readProjectFile('frontend/index.html');
    const styles = await readProjectFile('frontend/src/styles.css');

    assert.match(html, /id="view-marketplace" class="[^"]*\bflex-1\b[^"]*\bmin-h-0\b[^"]*\boverflow-y-auto\b[^"]*\bxl:overflow-hidden\b/);
    assert.match(html, /max-w-\[1840px\]/);
    assert.match(html, /<div class="marketplace-shell grid grid-cols-1 xl:grid-cols-\[280px_minmax\(0,1fr\)\] xl:grid-rows-\[minmax\(0,1fr\)\] gap-4 items-start xl:items-stretch xl:flex-1 min-h-0 overflow-visible xl:overflow-hidden">/);
    assert.match(html, /<aside class="marketplace-filter-panel[^"]*\bxl:h-full\b[^"]*\bmin-h-0\b[^"]*\boverflow-visible\b[^"]*\bxl:overflow-y-auto\b/);
    assert.match(html, /<div class="marketplace-results-panel[^"]*\bxl:h-full\b[^"]*\bmin-h-0\b[^"]*\bflex\b[^"]*\bflex-col\b[^"]*\boverflow-visible\b[^"]*\bxl:overflow-hidden\b/);
    assert.match(html, /id="skills-grid" class="[^"]*\bmarketplace-skills-grid\b[^"]*\bxl:flex-1\b[^"]*\bxl:min-h-0\b[^"]*\boverflow-visible\b[^"]*\bxl:overflow-y-auto\b[^"]*\bauto-rows-max\b/);
    assert.match(styles, /\.marketplace-filter-panel\s*{/);
    assert.match(styles, /@media\s*\(max-width:\s*767\.98px\)\s*{[\s\S]*\.marketplace-filter-panel\s*{[\s\S]*max-height:\s*min\(32rem,\s*42dvh\);[\s\S]*overflow-x:\s*hidden\s*!important;[\s\S]*overflow-y:\s*auto\s*!important;/);
    assert.match(styles, /@media\s*\(max-width:\s*1279\.98px\)\s*{[\s\S]*\.marketplace-shell\s*{[\s\S]*display:\s*block\s*!important;[\s\S]*min-height:\s*max-content\s*!important;[\s\S]*\.marketplace-results-panel\s*{[\s\S]*min-height:\s*max-content\s*!important;[\s\S]*margin-top:\s*1rem;/);
    assert.match(styles, /@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1279\.98px\)\s*{[\s\S]*\.marketplace-filter-panel\s*{[\s\S]*align-items:\s*start;[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(styles, /@media\s*\(min-width:\s*1024px\)\s*and\s*\(max-width:\s*1279\.98px\)\s*{[\s\S]*\.marketplace-filter-panel\s*{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(styles, /\.marketplace-filter-panel > :nth-child\(2\),\s*[\s\S]*\.marketplace-filter-panel > :nth-child\(3\)\s*{[\s\S]*grid-column:\s*span 2;/);
    assert.doesNotMatch(styles, /@media\s*\(min-width:\s*1024px\)\s*and\s*\(max-width:\s*1279\.98px\)\s*{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(styles, /@media\s*\(min-width:\s*1280px\)\s*{\s*\.marketplace-filter-panel\s*{\s*max-height:\s*calc\(100dvh - 6\.75rem\);/);
    assert.match(styles, /\.marketplace-skills-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*26rem\),\s*1fr\)\);/);
    assert.match(styles, /\.marketplace-shell,\s*[\s\S]*\.marketplace-results-panel,\s*[\s\S]*\.marketplace-skills-grid > \[data-skill-id\][\s\S]*min-width:\s*0;/);
    assert.match(styles, /\.marketplace-skills-grid > \[data-skill-id\]\s*{[\s\S]*overflow-wrap:\s*anywhere;/);
  });

  it('lets the marketplace switch between detail and summary card modes', async () => {
    const app = await readProjectFile('frontend/src/app.js');
    const html = await readProjectFile('frontend/index.html');
    const styles = await readProjectFile('frontend/src/styles.css');

    assert.match(html, /id="view-mode-detail"/);
    assert.match(html, /id="view-mode-summary"/);
    assert.match(html, /setCatalogViewMode\('detail'\)/);
    assert.match(html, /setCatalogViewMode\('summary'\)/);
    assert.match(app, /let catalogViewMode = 'detail'/);
    assert.match(app, /function setCatalogViewMode\(mode\)/);
    assert.match(app, /catalogViewMode === 'summary'/);
    assert.match(app, /function renderSummarySkillCards\(grid, skills\)/);
    assert.match(app, /skill-card-description/);
    assert.match(styles, /\.skill-card-description\s*{[\s\S]*min-height:\s*2\.5rem;[\s\S]*-webkit-line-clamp:\s*2;/);
    assert.match(app, /summary-skill-description/);
    assert.match(app, /data-skill-id="\$\{skill\.id\}" class="[^"]*\bh-full\b[^"]*\bflex\b[^"]*\bflex-col\b/);
    assert.match(app, /<div class="grid grid-cols-2 gap-2 mt-auto pt-4">/);
    assert.match(app, /skill\.short_description/);
    assert.match(styles, /\.summary-skill-description\s*{[\s\S]*overflow:\s*visible/);
    assert.match(app, /params\.set\('view', catalogViewMode\)/);
    assert.match(app, /skill\.type/);
    assert.match(app, /skill\.status/);
    assert.match(app, /설치됨/);
    assert.match(app, /상세보기/);
  });

  it('places marketplace search in the filter panel without the hero banner', async () => {
    const html = await readProjectFile('frontend/index.html');
    const app = await readProjectFile('frontend/src/app.js');

    assert.doesNotMatch(html, /사내 AI Agent를 위한 최적의 업무 스킬 탐색기/);
    assert.doesNotMatch(html, /업무 자동화 스킬을 즉시 장착하고 재사용하세요/);
    assert.match(html, /<aside class="marketplace-filter-panel[^"]*\bxl:h-full\b[\s\S]*id="main-search-input"[\s\S]*handleSearch\(\)[\s\S]*id="my-installed-filter-button"/);
    assert.match(html, /class="grid grid-cols-2 gap-1" id="filter-category"/);
    assert.match(html, /class="grid grid-cols-2 gap-1" id="filter-type"/);
    assert.match(html, /class="grid grid-cols-2 gap-1" id="filter-status"/);
    assert.match(html, /class="grid grid-cols-2 gap-1" id="filter-visibility"/);
    assert.match(html, /items-center justify-between gap-2 bg-white px-2 py-1\.5 rounded-lg border/);
    assert.match(html, /id="active-filter-badges" class="hidden shrink-0 flex-wrap gap-2 items-center"/);
    assert.match(app, /container\.classList\.toggle\('hidden',\s*badgesHTML\.trim\(\) === ''\)/);
    assert.match(app, /container\.classList\.toggle\('flex',\s*badgesHTML\.trim\(\) !== ''\)/);
  });

  it('suppresses toast feedback banners from the app shell', async () => {
    const html = await readProjectFile('frontend/index.html');
    const app = await readProjectFile('frontend/src/app.js');

    assert.doesNotMatch(html, /id="toast-container"/);
    assert.match(app, /function showToast\(message, type = 'success'\)/);
    assert.match(app, /return \{ message, type, suppressed: true \};/);
    assert.doesNotMatch(app, /document\.createElement\('div'\)/);
    assert.doesNotMatch(app, /container\.appendChild\(toast\)/);
  });

  it('exposes stable backend API placeholders for the future app', async () => {
    const server = await readProjectFile('backend/server.js');

    assert.match(server, /GET \/api\/health/);
    assert.match(server, /GET \/api\/skills/);
    assert.match(server, /GET \/api\/installations/);
    assert.match(server, /POST \/api\/installations/);
    assert.match(server, /DELETE \/api\/installations/);
    assert.match(server, /POST \/api\/skills\/:skillId\/fork/);
    assert.match(server, /DELETE \/api\/skills\/:skillId/);
    assert.match(server, /PUT \/api\/skills\/:skillId\/files/);
    assert.match(server, /frontend\/index\.html/);
  });

  it('stores installed skills separately for each account', async () => {
    const { installSkillForAccount, readInstalledSkillIds, removeSkillFromAllInstallations, uninstallSkillForAccount } = await import('../backend/lib/installations.js');
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-marketplace-install-'));

    try {
      await installSkillForAccount({
        accountId: 'oh-myeongcheol',
        skillId: 'investment-report'
      }, tempRoot);
      await installSkillForAccount({
        accountId: 'kim-user',
        skillId: 'contract-review'
      }, tempRoot);
      await installSkillForAccount({
        accountId: 'oh-myeongcheol',
        skillId: 'investment-report'
      }, tempRoot);
      await uninstallSkillForAccount({
        accountId: 'oh-myeongcheol',
        skillId: 'investment-report'
      }, tempRoot);
      await installSkillForAccount({
        accountId: 'oh-myeongcheol',
        skillId: 'investment-report'
      }, tempRoot);
      await installSkillForAccount({
        accountId: 'kim-user',
        skillId: 'shared-draft'
      }, tempRoot);
      await installSkillForAccount({
        accountId: 'oh-myeongcheol',
        skillId: 'shared-draft'
      }, tempRoot);
      await removeSkillFromAllInstallations('shared-draft', tempRoot);

      assert.deepEqual(await readInstalledSkillIds('oh-myeongcheol', tempRoot), ['investment-report']);
      assert.deepEqual(await readInstalledSkillIds('kim-user', tempRoot), ['contract-review']);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('lets the frontend show only skills installed by the current account', async () => {
    const app = await readProjectFile('frontend/src/app.js');
    const html = await readProjectFile('frontend/index.html');
    const styles = await readProjectFile('frontend/src/styles.css');

    assert.match(app, /CURRENT_ACCOUNT\s*=\s*{/);
    assert.match(app, /installedSkillIds\s*=\s*new Set/);
    assert.match(app, /fetch\(`\/api\/installations\?accountId=\$\{encodeURIComponent\(CURRENT_ACCOUNT\.id\)\}`\)/);
    assert.match(app, /fetch\('\/api\/installations'/);
    assert.match(app, /method:\s*'DELETE'/);
    assert.match(app, /myInstalled:\s*false/);
    assert.match(app, /activeFilters\.myInstalled/);
    assert.match(app, /installedSkillIds\.has\(item\.id\)/);
    assert.match(app, /function showMyInstalledSkills\(\)/);
    assert.match(app, /const willEnable = !activeFilters\.myInstalled/);
    assert.match(app, /showMyInstalledSkills\(\)\s*{[\s\S]*activeFilters\.myDrafts = false/);
    assert.match(html, /showMyInstalledSkills\(\)/);
    assert.match(app, /myDrafts:\s*false/);
    assert.match(app, /function showMyDraftSkills\(\)/);
    assert.match(app, /const willEnable = !activeFilters\.myDrafts/);
    assert.match(app, /showMyDraftSkills\(\)\s*{[\s\S]*activeFilters\.myInstalled = false/);
    assert.match(app, /function normalizePersonalFilterMode\(\)/);
    assert.match(app, /function isCurrentAccountDraftSkill\(skill\)/);
    assert.match(app, /function canCurrentAccountDeleteDraftSkill\(skill\)/);
    assert.match(app, /function deleteDraftSkillForCurrentAccount\(skill\)/);
    assert.match(app, /fetch\(`\/api\/skills\/\$\{encodeURIComponent\(skill\.id\)\}`/);
    assert.match(app, /method:\s*'DELETE'/);
    assert.match(app, /currentSkills\s*=\s*currentSkills\.filter\(candidate => candidate\.id !== skill\.id\)/);
    assert.match(app, /quickAction\('\$\{skill\.id\}', 'delete-draft'\)/);
    assert.match(html, /my-drafts-filter-button/);

    const installSkillBody = app.match(/async function installSkillForCurrentAccount\(skill\) \{[\s\S]*?\n        \}/)?.[0] || '';
    assert.doesNotMatch(installSkillBody, /activeFilters\.myInstalled\s*=\s*true/);
    assert.doesNotMatch(installSkillBody, /pushCatalogHistory\(\)/);
    assert.match(installSkillBody, /refreshCatalogResults\(\)/);
    assert.match(app, /function uninstallSkillForCurrentAccount\(skill\)/);
    assert.match(app, /installedSkillIds\.delete\(skill\.id\)/);
    assert.match(app, /renderInstallActionButton\(skill/);
    assert.match(app, /install-hover-label">삭제/);
    assert.doesNotMatch(app, /px-1\.5 py-0\.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">설치됨/);
    assert.match(styles, /\.install-action-button\.is-installed:hover/);
    assert.match(styles, /color:\s*#b91c1c/);
    assert.match(styles, /\.install-action-button\s*\{[\s\S]*min-height:\s*2rem/);
    assert.match(styles, /\.install-action-button\s+\.install-default-label/);
    assert.doesNotMatch(app, /install-action-button[^`]*active:scale-95/);
  });

  it('shows common as the first business area filter after all', async () => {
    const app = await readProjectFile('frontend/src/app.js');

    assert.match(app, /const categories = \['전체', '공통', '투자관리'/);
  });

  it('ships a rich office-centered sample skill catalog', async () => {
    const skills = await readBackendOfficialSkills();
    const officeCategories = new Set(['공통', '투자관리', '사업관리', '경영기획', '재무', '구매', '설비', '법무', 'HR']);
    const officeSkills = skills.filter((skill) => officeCategories.has(skill.category));
    const commonSkills = skills.filter((skill) => skill.category === '공통');
    const uniqueIds = new Set(skills.map((skill) => skill.id));

    assert.equal(skills.length, 26);
    assert.equal(uniqueIds.size, 26);
    assert.equal(commonSkills.length, 2);
    assert.ok(officeSkills.length >= 20);
    assert.ok(skills.every((skill) => skill.name && skill.short_description && skill.owner && skill.team));
    assert.ok(skills.every((skill) => Array.isArray(skill.tags) && skill.tags.length >= 4));
  });

  it('uses person names with titles for skill owners and department names for teams', async () => {
    const backendSkills = await readBackendSkills();
    const frontendSkills = await readFrontendSkills();
    const ownerNamePattern = /^[가-힣]{2,4}\s(사원|대리|과장|차장|리더|부장)$/;
    const organizationSuffixPattern = /(팀|그룹|실|센터|본부|TF|데스크|과)$/;

    for (const skill of [...backendSkills, ...frontendSkills]) {
      assert.match(skill.owner, ownerNamePattern, `${skill.id} owner should be a person name with title`);
      assert.doesNotMatch(skill.owner, organizationSuffixPattern, `${skill.id} owner should not be an organization`);
      assert.ok(skill.team && skill.team !== skill.owner, `${skill.id} team should be a separate department name`);
    }
  });

  it('stores samples as real skill packages that can later be replaced one by one', async () => {
    const skills = await readBackendOfficialSkills();

    assert.equal(skills.length, 26);
    assert.ok(skills.every((skill) => skill.source_path.startsWith('official/')));

    for (const skill of skills) {
      const folder = path.join(repoRoot, 'skills', skill.source_path);
      const manifest = JSON.parse(await readFile(path.join(folder, 'skill.json'), 'utf8'));
      const skillMd = await readFile(path.join(folder, 'SKILL.md'), 'utf8');
      const openAiYaml = await readFile(path.join(folder, 'agents', 'openai.yaml'), 'utf8');
      const schema = JSON.parse(await readFile(path.join(folder, 'references', 'input.schema.json'), 'utf8'));

      assert.doesNotMatch(skill.id, /^skill-\d+$/);
      assert.match(skill.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(manifest.id, skill.id);
      assert.equal(manifest.sort_order > 0, true);
      assert.equal(manifest.entrypoint, 'SKILL.md');
      assert.match(skillMd, /^---\nname:/);
      assert.match(skillMd, new RegExp(`# ${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      assert.match(openAiYaml, /interface:/);
      assert.equal(schema.type, 'object');
      assert.deepEqual(skill.files.includes('SKILL.md'), true);
      assert.deepEqual(skill.files.includes('agents/openai.yaml'), true);
      assert.deepEqual(skill.files.includes('references/input.schema.json'), true);
    }
  });

  it('discovers nested external skills from SKILL.md even before marketplace metadata exists', async () => {
    const { readSkillCatalog } = await import('../backend/lib/skillCatalog.js');
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-marketplace-import-'));
    const externalFolder = path.join(tempRoot, 'imported', 'vendor-a', 'daily-brief-skill');

    try {
      await mkdir(externalFolder, { recursive: true });
      await writeFile(path.join(externalFolder, 'SKILL.md'), `---
name: daily-brief-skill
description: Summarize daily business updates into an executive-ready brief.
---

# Daily Brief Skill

Use this skill to prepare a concise daily business brief.
`, 'utf8');

      const catalog = await readSkillCatalog(tempRoot);

      assert.equal(catalog.length, 1);
      assert.equal(catalog[0].id, 'daily-brief-skill');
      assert.equal(catalog[0].has_manifest, false);
      assert.equal(catalog[0].source_path, 'imported/vendor-a/daily-brief-skill');
      assert.equal(catalog[0].entrypoint, 'SKILL.md');
      assert.equal(catalog[0].files.includes('SKILL.md'), true);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps frontend and backend skill samples in sync', async () => {
    const backendSkills = await readBackendOfficialSkills();
    const frontendSkills = await readFrontendSkills();

    const frontendIds = JSON.parse(JSON.stringify(frontendSkills.map((skill) => skill.id)));
    const backendIds = backendSkills.map((skill) => skill.id);

    assert.deepEqual(frontendIds, backendIds);
  });

  it('preflights and stops any existing port listener before launching from the Windows runner', async () => {
    const batchRunner = await readProjectFile('run.bat');
    const powershellRunner = await readProjectFile('scripts/run-server.ps1');

    assert.doesNotMatch(batchRunner, /\[AI Skill Marketplace\] Starting server/);
    assert.match(powershellRunner, /function Stop-ExistingProcessOnPort/);
    assert.match(powershellRunner, /Get-NetTCPConnection/);
    assert.match(powershellRunner, /Stop-Process -Id \$processId -Force/);
    assert.match(powershellRunner, /already uses port \$BindPort/);
  });

  it('keeps the Windows installer open after npm commands finish', async () => {
    const installer = await readProjectFile('Install.bat');

    assert.match(installer, /^\s*call npm --version\s*$/m);
    assert.match(installer, /^\s*call npm install\s*$/m);
    assert.match(installer, /^\s*pause\s*$/m);
  });

  it('persists a registered skill as a replaceable skill package', async () => {
    const { createSkillPackage, readSkillCatalog } = await import('../backend/lib/skillCatalog.js');
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-marketplace-test-'));

    try {
      const created = await createSkillPackage({
        name: '테스트 정산 자동화',
        short_description: '정산 요청서를 검토하고 누락 증빙을 알려줍니다.',
        category: '재무',
        type: '문서분석형',
        visibility: '전사 공개',
        tags: ['정산', '증빙', '재무', '자동화']
      }, tempRoot);
      const catalog = await readSkillCatalog(tempRoot);
      const folder = path.join(tempRoot, created.source_path);

      assert.equal(catalog.length, 1);
      assert.equal(catalog[0].id, created.id);
      assert.equal(catalog[0].name, '테스트 정산 자동화');
      assert.equal((await stat(folder)).isDirectory(), true);
      assert.match(await readFile(path.join(folder, 'SKILL.md'), 'utf8'), /테스트 정산 자동화/);
      assert.match(await readFile(path.join(folder, 'agents', 'openai.yaml'), 'utf8'), /default_prompt/);
      assert.equal(JSON.parse(await readFile(path.join(folder, 'references', 'input.schema.json'), 'utf8')).type, 'object');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('updates text files only when the current account owns the skill', async () => {
    const { createSkillPackage, updateSkillFile } = await import('../backend/lib/skillCatalog.js');
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-marketplace-edit-'));

    try {
      const created = await createSkillPackage({
        name: '편집 가능한 정산 스킬',
        short_description: '정산 문서를 검토합니다.',
        category: '재무',
        type: '문서분석형',
        owner: '오명철 과장',
        team: '경영기획DX추진TF팀',
        visibility: '전사 공개',
        tags: ['정산', '편집', '재무', '검토']
      }, tempRoot);

      await assert.rejects(
        updateSkillFile({
          skillId: created.id,
          accountId: 'kim-user',
          accountName: '김사용 과장',
          filePath: 'SKILL.md',
          content: '# Forbidden edit'
        }, tempRoot),
        /Only the skill owner or fork owner can edit this skill/
      );

      const result = await updateSkillFile({
        skillId: created.id,
        accountId: 'oh-myeongcheol',
        accountName: '오명철 과장',
        filePath: 'SKILL.md',
        content: '# Edited skill text\n'
      }, tempRoot);

      assert.equal(result.filePath, 'SKILL.md');
      assert.equal(result.content, '# Edited skill text\n');
      assert.equal(await readFile(path.join(tempRoot, created.source_path, 'SKILL.md'), 'utf8'), '# Edited skill text\n');

      const adminResult = await updateSkillFile({
        skillId: created.id,
        accountId: 'kim-user',
        accountName: '김사용 과장',
        adminPassword: '1',
        filePath: 'SKILL.md',
        content: '# Admin edited skill text\n'
      }, tempRoot);

      assert.equal(adminResult.content, '# Admin edited skill text\n');
      assert.equal(await readFile(path.join(tempRoot, created.source_path, 'SKILL.md'), 'utf8'), '# Admin edited skill text\n');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('updates skill header metadata by saving skill.json through the existing editor API', async () => {
    const { createSkillPackage, updateSkillFile } = await import('../backend/lib/skillCatalog.js');
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-marketplace-meta-edit-'));

    try {
      const created = await createSkillPackage({
        name: '편집 전 스킬명',
        short_description: '편집 전 한 줄 설명입니다.',
        category: '재무',
        type: '문서분석형',
        owner: '오명철 과장',
        team: '경영기획DX추진TF팀',
        visibility: '전사 공개',
        tags: ['정산', '편집', '재무', '검토']
      }, tempRoot);

      const manifest = JSON.parse(await readFile(path.join(tempRoot, created.source_path, 'skill.json'), 'utf8'));
      manifest.name = '상단에서 수정한 스킬명';
      manifest.short_description = '상단 편집 패널에서 저장한 설명입니다.';
      manifest.status = 'Verified';
      manifest.icon = 'sparkles';

      const result = await updateSkillFile({
        skillId: created.id,
        accountId: 'oh-myeongcheol',
        accountName: '오명철 과장',
        filePath: 'skill.json',
        content: `${JSON.stringify(manifest, null, 2)}\n`
      }, tempRoot);

      assert.equal(result.filePath, 'skill.json');
      assert.equal(result.skill.name, '상단에서 수정한 스킬명');
      assert.equal(result.skill.short_description, '상단 편집 패널에서 저장한 설명입니다.');
      assert.equal(result.skill.status, 'Verified');
      assert.equal(result.skill.icon, 'sparkles');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('lets a fork owner edit the fork without changing the original package', async () => {
    const { createSkillPackage, deleteSkillPackage, forkSkillPackage, updateSkillFile } = await import('../backend/lib/skillCatalog.js');
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-marketplace-fork-'));

    try {
      const original = await createSkillPackage({
        name: '원본 법무 스킬',
        short_description: '계약 문구를 검토합니다.',
        category: '법무',
        type: '프롬프트형',
        owner: '정다은 과장',
        team: '법무기획실',
        visibility: '전사 공개',
        tags: ['법무', '계약', '검토', '원본']
      }, tempRoot);
      const originalText = await readFile(path.join(tempRoot, original.source_path, 'SKILL.md'), 'utf8');

      const forked = await forkSkillPackage({
        skillId: original.id,
        accountId: 'oh-myeongcheol',
        accountName: '오명철 과장',
        accountTeam: '경영기획DX추진TF팀'
      }, tempRoot);

      assert.equal(forked.forked_from, original.id);
      assert.equal(forked.forked_by_account_id, 'oh-myeongcheol');
      assert.equal(forked.owner, '오명철 과장');

      await updateSkillFile({
        skillId: forked.id,
        accountId: 'oh-myeongcheol',
        accountName: '오명철 과장',
        filePath: 'references/input.schema.json',
        content: '{ "type": "object" }\n'
      }, tempRoot);

      assert.equal(await readFile(path.join(tempRoot, original.source_path, 'SKILL.md'), 'utf8'), originalText);
      assert.equal(await readFile(path.join(tempRoot, forked.source_path, 'references', 'input.schema.json'), 'utf8'), '{ "type": "object" }\n');

      await assert.rejects(
        deleteSkillPackage({
          skillId: original.id,
          accountId: 'oh-myeongcheol',
          accountName: '오명철 과장'
        }, tempRoot),
        /Only the skill owner or fork owner can edit this skill|Only draft or fork skills can be deleted/
      );

      await deleteSkillPackage({
        skillId: forked.id,
        accountId: 'oh-myeongcheol',
        accountName: '오명철 과장'
      }, tempRoot);

      await assert.rejects(stat(path.join(tempRoot, forked.source_path)), /ENOENT/);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
