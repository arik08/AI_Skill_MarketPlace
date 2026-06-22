import { randomUUID } from 'node:crypto';
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultSkillsRoot = path.join(repoRoot, 'skills');

const ignoredDirectoryNames = new Set(['.git', '.marketplace', 'node_modules']);
const skillMarkerFiles = new Set(['skill.json', 'SKILL.md']);
const catalogFileNames = new Set(['skill.json', 'SKILL.md', 'openai.yaml', 'input.schema.json', 'sample-input.json']);

const requiredManifestFields = [
  'id',
  'name',
  'short_description',
  'owner',
  'team',
  'category',
  'type',
  'status',
  'visibility',
  'version',
  'updated_at',
  'tags',
  'entrypoint'
];

const categorySlugMap = {
  공통: 'common',
  투자관리: 'investment',
  사업관리: 'business',
  경영기획: 'management',
  재무: 'finance',
  구매: 'procurement',
  설비: 'equipment',
  법무: 'legal',
  HR: 'hr'
};

const categoryBySlug = Object.fromEntries(
  Object.entries(categorySlugMap).map(([label, slug]) => [slug, label])
);

const typeSlugMap = {
  프롬프트형: 'prompt',
  문서분석형: 'document-analysis',
  데이터분석형: 'data-analysis',
  보고서생성형: 'report-generator',
  API연계형: 'api',
  'MCP Tool형': 'mcp-tool'
};

const koreanSlugTokens = [
  ['투자', 'investment'],
  ['타당성', 'feasibility'],
  ['검토', 'review'],
  ['정산', 'settlement'],
  ['자동화', 'automation'],
  ['증빙', 'receipt'],
  ['보고서', 'report'],
  ['회의록', 'meeting-notes'],
  ['계약', 'contract'],
  ['예산', 'budget'],
  ['구매', 'procurement'],
  ['견적', 'quote'],
  ['비교', 'comparison'],
  ['법무', 'legal'],
  ['개인정보', 'privacy'],
  ['문서', 'document'],
  ['마스킹', 'masking'],
  ['채용', 'hiring'],
  ['교육', 'training'],
  ['설문', 'survey'],
  ['시장', 'market'],
  ['경쟁사', 'competitor'],
  ['규정', 'policy'],
  ['고객사', 'client'],
  ['출장비', 'travel-expense'],
  ['요청', 'request'],
  ['분류', 'triage']
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createPublicError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toSlug(value, fallback = 'office-skill') {
  const directSlug = String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return directSlug || fallback;
}

function slugifySkillName(name, category, type) {
  const source = String(name || '').trim();
  const tokens = [];
  for (const [keyword, slug] of koreanSlugTokens) {
    if (source.includes(keyword)) {
      tokens.push(slug);
    }
  }

  if (tokens.length > 0) {
    return [...new Set(tokens)].join('-').slice(0, 56).replace(/-+$/g, '');
  }

  const directSlug = toSlug(source, '');

  if (directSlug && directSlug !== 'skill') {
    return directSlug.slice(0, 56).replace(/-+$/g, '');
  }

  return [
    categorySlugMap[category] || 'office',
    typeSlugMap[type] || 'skill'
  ].join('-');
}

function normalizeTags(tags, category, type) {
  const parsedTags = Array.isArray(tags)
    ? tags
    : String(tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  const normalized = [...new Set([category, type, ...parsedTags].filter(Boolean))];

  while (normalized.length < 4) {
    normalized.push(['업무자동화', '사무스킬', '초안작성', '검토지원'][normalized.length]);
  }

  return normalized;
}

function parseSimpleYamlValue(line, key) {
  const match = line.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`));
  if (!match) {
    return '';
  }

  return match[1].replace(/^['"]|['"]$/g, '').trim();
}

function parseSkillMarkdown(source) {
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = frontmatterMatch?.[1] || '';
  const lines = frontmatter.split(/\r?\n/);
  const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  const name = lines.map((line) => parseSimpleYamlValue(line, 'name')).find(Boolean) || heading;
  const description = lines.map((line) => parseSimpleYamlValue(line, 'description')).find(Boolean) || '';

  return { name, description };
}

function inferCategoryFromPath(relativeFolder) {
  const segments = relativeFolder.split(/[\\/]/).map((segment) => segment.toLowerCase());
  const matched = segments.find((segment) => categoryBySlug[segment]);

  return matched ? categoryBySlug[matched] : '경영기획';
}

function validateManifest(manifest, folderLabel) {
  for (const field of requiredManifestFields) {
    if (!manifest[field]) {
      throw new Error(`${folderLabel}/skill.json is missing ${field}`);
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) {
    throw new Error(`${folderLabel}/skill.json id must be a lowercase hyphen-case value`);
  }

  if (!Array.isArray(manifest.tags) || manifest.tags.length < 4) {
    throw new Error(`${folderLabel}/skill.json must include at least four tags`);
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function findSkillFolders(root, current = root, found = []) {
  const entries = await readdir(current, { withFileTypes: true });
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const hasSkillMarker = [...skillMarkerFiles].some((fileName) => fileNames.has(fileName));

  if (hasSkillMarker) {
    found.push(current);
    return found;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    await findSkillFolders(root, path.join(current, entry.name), found);
  }

  return found;
}

async function collectSkillFiles(folder) {
  const files = [];
  const fileContents = {};

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          await walk(path.join(current, entry.name));
        }
        continue;
      }

      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(folder, fullPath).replaceAll(path.sep, '/');

      files.push(relativePath);

      if (catalogFileNames.has(entry.name)) {
        fileContents[relativePath] = await readFile(fullPath, 'utf8');
      }
    }
  }

  await walk(folder);

  return {
    files: files.sort((a, b) => a.localeCompare(b)),
    file_contents: fileContents
  };
}

async function normalizeSkillFolder(folder, skillsRoot) {
  const relativeFolder = path.relative(skillsRoot, folder).replaceAll(path.sep, '/');
  const folderName = path.basename(folder);
  const manifestPath = path.join(folder, 'skill.json');
  const skillMdPath = path.join(folder, 'SKILL.md');
  const rawManifest = await readJsonIfExists(manifestPath);
  const skillMd = await readTextIfExists(skillMdPath);
  const skillMdMeta = skillMd ? parseSkillMarkdown(skillMd) : {};
  const category = rawManifest?.category || inferCategoryFromPath(relativeFolder);
  const type = rawManifest?.type || '프롬프트형';
  const displayName = rawManifest?.name || skillMdMeta.name || folderName;
  const shortDescription = rawManifest?.short_description || skillMdMeta.description || '외부에서 추가된 스킬입니다. 상세 정보는 시스템에서 보완할 수 있습니다.';
  const id = rawManifest?.id || toSlug(skillMdMeta.name || folderName);
  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const skill = {
    id,
    name: displayName,
    short_description: shortDescription,
    owner: rawManifest?.owner || '미등록',
    team: rawManifest?.team || '미지정',
    downloads: Number(rawManifest?.downloads || 0),
    likes: Number(rawManifest?.likes || 0),
    runs: Number(rawManifest?.runs || 0),
    success_rate: Number(rawManifest?.success_rate || 100),
    quality_score: Number(rawManifest?.quality_score || 70),
    category,
    type,
    status: rawManifest?.status || 'Imported',
    visibility: rawManifest?.visibility || '검토 필요',
    version: rawManifest?.version || 'v0.1.0',
    updated_at: rawManifest?.updated_at || now,
    tags: normalizeTags(rawManifest?.tags, category, type),
    icon: rawManifest?.icon || 'book-open-check',
    runtime: rawManifest?.runtime || 'codex-skill',
    entrypoint: rawManifest?.entrypoint || 'SKILL.md',
    input_schema: rawManifest?.input_schema || 'references/input.schema.json',
    example_input: rawManifest?.example_input || 'examples/sample-input.json',
    sort_order: Number(rawManifest?.sort_order || Number.MAX_SAFE_INTEGER),
    forked_from: rawManifest?.forked_from || '',
    forked_by_account_id: rawManifest?.forked_by_account_id || '',
    forked_at: rawManifest?.forked_at || '',
    source_path: relativeFolder,
    has_manifest: isRecord(rawManifest),
    ...await collectSkillFiles(folder)
  };

  validateManifest(skill, relativeFolder);

  return skill;
}

export async function readSkillCatalog(skillsRoot = defaultSkillsRoot) {
  const folders = await findSkillFolders(skillsRoot);
  const skills = [];

  for (const folder of folders) {
    skills.push(await normalizeSkillFolder(folder, skillsRoot));
  }

  return skills.sort((a, b) => {
    const orderA = Number.isFinite(a.sort_order) ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.sort_order) ? b.sort_order : Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.id.localeCompare(b.id);
  });
}

async function readSkillById(skillId, skillsRoot = defaultSkillsRoot) {
  const normalizedSkillId = String(skillId || '').trim();

  if (!normalizedSkillId) {
    throw createPublicError('skillId is required');
  }

  const skill = (await readSkillCatalog(skillsRoot)).find((candidate) => candidate.id === normalizedSkillId);

  if (!skill) {
    throw createPublicError('Skill not found', 404);
  }

  return skill;
}

function getSkillFolder(skill, skillsRoot = defaultSkillsRoot) {
  const folder = path.resolve(skillsRoot, skill.source_path);
  const root = path.resolve(skillsRoot);

  if (folder !== root && !folder.startsWith(`${root}${path.sep}`)) {
    throw createPublicError('Skill path is outside the skills root', 403);
  }

  return folder;
}

function resolveSkillFilePath(skill, filePath, skillsRoot = defaultSkillsRoot) {
  const relativePath = String(filePath || '').trim().replaceAll('\\', '/');

  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('\0') || relativePath.split('/').includes('..')) {
    throw createPublicError('filePath must be a relative path inside the skill package');
  }

  const folder = getSkillFolder(skill, skillsRoot);
  const fullPath = path.resolve(folder, relativePath);

  if (fullPath !== folder && !fullPath.startsWith(`${folder}${path.sep}`)) {
    throw createPublicError('filePath must stay inside the skill package', 403);
  }

  return {
    folder,
    filePath: relativePath,
    fullPath
  };
}

function canAccountEditSkill(skill, accountId, accountName) {
  const normalizedAccountId = String(accountId || '').trim();
  const normalizedAccountName = String(accountName || '').trim();
  const ownedByName = normalizedAccountName && skill.owner === normalizedAccountName;
  const forkedByAccount = normalizedAccountId && skill.forked_by_account_id === normalizedAccountId;
  const ownDraft = normalizedAccountName
    && skill.source_path?.startsWith('drafts/')
    && skill.owner === normalizedAccountName;

  return Boolean(ownedByName || forkedByAccount || ownDraft);
}

function assertEditableSkill(skill, input) {
  if (!canAccountEditSkill(skill, input?.accountId, input?.accountName)) {
    throw createPublicError('Only the skill owner or fork owner can edit this skill', 403);
  }
}

export async function updateSkillFile(input, skillsRoot = defaultSkillsRoot) {
  const skill = await readSkillById(input?.skillId, skillsRoot);
  assertEditableSkill(skill, input);

  const { folder, filePath, fullPath } = resolveSkillFilePath(skill, input?.filePath, skillsRoot);
  const fileStat = await stat(fullPath).catch((error) => {
    if (error.code === 'ENOENT') {
      throw createPublicError('Skill file not found', 404);
    }

    throw error;
  });

  if (!fileStat.isFile()) {
    throw createPublicError('Skill file path must point to a file');
  }

  const content = String(input?.content ?? '');

  if (filePath === 'skill.json') {
    const manifest = JSON.parse(content);
    validateManifest(manifest, skill.source_path);

    if (manifest.id !== skill.id) {
      throw createPublicError('skill.json id cannot be changed from this editor');
    }
  }

  await writeFile(fullPath, content, 'utf8');

  return {
    filePath,
    content,
    skill: await normalizeSkillFolder(folder, skillsRoot)
  };
}

function createSkillMarkdown(skill) {
  return `---
name: ${skill.id}
description: ${skill.short_description} Use when Codex needs to perform or assist with ${skill.category} office work using this reusable skill.
---

# ${skill.name}

## Goal

${skill.short_description}

## Workflow

1. Read the user's request, business context, and attached material summary.
2. Identify missing inputs, sensitive information, and approval risks before drafting.
3. Produce a concise working output that can be pasted into a report, memo, review note, or meeting material.
4. Mark assumptions clearly and list follow-up checks when the source material is incomplete.

## Output Shape

- 핵심 요약
- 주요 판단 근거
- 리스크 및 확인 필요 사항
- 다음 액션 제안

## Guardrails

- Do not invent numeric facts, legal conclusions, or policy approvals.
- Flag 개인정보, 계약, 재무 수치, 인사 정보, and confidential material before reuse.
- Keep the tone practical, specific, and suitable for internal office work.
`;
}

function createOpenAiYaml(skill) {
  return `interface:
  display_name: "${skill.name.replaceAll('"', '\\"')}"
  short_description: "${skill.short_description.slice(0, 64).replaceAll('"', '\\"')}"
  default_prompt: "Use $${skill.id} to prepare a practical internal work draft."

policy:
  allow_implicit_invocation: true
`;
}

function createInputSchema(skill) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `${skill.name} Input`,
    type: 'object',
    additionalProperties: false,
    properties: {
      request: {
        type: 'string',
        minLength: 1,
        description: '사용자가 원하는 업무 요청 또는 질문'
      },
      context: {
        type: 'string',
        description: '업무 배경, 부서 상황, 보고 대상 등 추가 맥락'
      },
      attachments_summary: {
        type: 'string',
        description: '첨부 문서나 표 데이터가 있을 때 핵심 내용 요약'
      },
      output_format: {
        type: 'string',
        enum: ['brief', 'memo', 'report', 'table'],
        default: 'memo'
      }
    },
    required: ['request']
  };
}

export async function createSkillPackage(input, skillsRoot = defaultSkillsRoot) {
  const now = new Date();
  const baseId = input.id || slugifySkillName(input.name, input.category, input.type);
  const id = input.id ? String(input.id).trim() : `${baseId}-${randomUUID().slice(0, 8)}`;
  const category = String(input.category || '경영기획').trim();
  const type = String(input.type || '프롬프트형').trim();
  const skill = {
    id,
    name: String(input.name || '').trim(),
    short_description: String(input.short_description || '').trim(),
    owner: String(input.owner || '오명철 과장').trim(),
    team: String(input.team || '경영기획DX추진TF팀').trim(),
    downloads: Number(input.downloads || 0),
    likes: Number(input.likes || 0),
    runs: Number(input.runs || 0),
    success_rate: Number(input.success_rate || 100),
    quality_score: Number(input.quality_score || 90),
    category,
    type,
    status: String(input.status || 'Draft').trim(),
    visibility: String(input.visibility || '전사 공개').trim(),
    version: String(input.version || 'v1.0.0').trim(),
    updated_at: input.updated_at || now.toISOString().slice(0, 10).replace(/-/g, '.'),
    tags: normalizeTags(input.tags, category, type),
    icon: input.icon || 'book-open-check',
    runtime: input.runtime || 'codex-skill',
    entrypoint: input.entrypoint || 'SKILL.md',
    input_schema: input.input_schema || 'references/input.schema.json',
    example_input: input.example_input || 'examples/sample-input.json'
  };

  validateManifest(skill, id);

  const categoryFolder = categorySlugMap[category] || 'general';
  const folder = path.join(skillsRoot, 'drafts', categoryFolder, id);
  await mkdir(path.join(folder, 'agents'), { recursive: true });
  await mkdir(path.join(folder, 'references'), { recursive: true });
  await mkdir(path.join(folder, 'examples'), { recursive: true });

  const sampleInput = {
    request: `${skill.name}을 사용해 현재 업무 자료를 검토하고 초안을 만들어줘.`,
    context: `${skill.team}에서 ${skill.category} 업무에 활용할 예정입니다.`,
    attachments_summary: '등록 화면에서 생성된 기본 샘플입니다. 실제 스킬 연결 시 문서 요약 또는 시스템 조회 결과가 들어옵니다.',
    output_format: 'memo'
  };

  await writeFile(path.join(folder, 'skill.json'), `${JSON.stringify(skill, null, 2)}\n`, 'utf8');
  await writeFile(path.join(folder, 'SKILL.md'), createSkillMarkdown(skill), 'utf8');
  await writeFile(path.join(folder, 'agents', 'openai.yaml'), createOpenAiYaml(skill), 'utf8');
  await writeFile(path.join(folder, 'references', 'input.schema.json'), `${JSON.stringify(createInputSchema(skill), null, 2)}\n`, 'utf8');
  await writeFile(path.join(folder, 'examples', 'sample-input.json'), `${JSON.stringify(sampleInput, null, 2)}\n`, 'utf8');

  return normalizeSkillFolder(folder, skillsRoot);
}

export async function forkSkillPackage(input, skillsRoot = defaultSkillsRoot) {
  const sourceSkill = await readSkillById(input?.skillId, skillsRoot);
  const accountId = String(input?.accountId || '').trim();
  const accountName = String(input?.accountName || '').trim();
  const accountTeam = String(input?.accountTeam || '').trim();

  if (!accountId) {
    throw createPublicError('accountId is required');
  }

  if (!accountName) {
    throw createPublicError('accountName is required');
  }

  const accountSlug = toSlug(accountId, 'account');
  const baseId = `${sourceSkill.id}-fork-${accountSlug}`;
  let forkId = baseId;
  let forkFolder = path.join(skillsRoot, 'drafts', 'forks', accountSlug, forkId);

  if (await pathExists(forkFolder)) {
    forkId = `${baseId}-${randomUUID().slice(0, 8)}`;
    forkFolder = path.join(skillsRoot, 'drafts', 'forks', accountSlug, forkId);
  }

  await mkdir(path.dirname(forkFolder), { recursive: true });
  await cp(getSkillFolder(sourceSkill, skillsRoot), forkFolder, {
    recursive: true,
    errorOnExist: true,
    force: false
  });

  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const forkManifest = {
    id: forkId,
    name: `${sourceSkill.name} (Fork)`,
    short_description: sourceSkill.short_description,
    owner: accountName,
    team: accountTeam || sourceSkill.team,
    downloads: 0,
    likes: 0,
    runs: 0,
    success_rate: sourceSkill.success_rate,
    quality_score: sourceSkill.quality_score,
    category: sourceSkill.category,
    type: sourceSkill.type,
    status: 'Draft',
    visibility: sourceSkill.visibility,
    version: 'v1.0.0',
    updated_at: now,
    tags: normalizeTags(sourceSkill.tags, sourceSkill.category, sourceSkill.type),
    icon: sourceSkill.icon,
    runtime: sourceSkill.runtime,
    entrypoint: sourceSkill.entrypoint,
    input_schema: sourceSkill.input_schema,
    example_input: sourceSkill.example_input,
    forked_from: sourceSkill.id,
    forked_by_account_id: accountId,
    forked_at: now
  };

  validateManifest(forkManifest, forkId);
  await writeFile(path.join(forkFolder, 'skill.json'), `${JSON.stringify(forkManifest, null, 2)}\n`, 'utf8');

  return normalizeSkillFolder(forkFolder, skillsRoot);
}
