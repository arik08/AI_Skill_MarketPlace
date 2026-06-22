import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultInstallationsRoot = path.join(repoRoot, 'skills');
const marketplaceFolderName = '.marketplace';
const installationFileName = 'installations.json';

function getInstallationsPath(root) {
  return path.join(root, marketplaceFolderName, installationFileName);
}

function normalizeId(value, label) {
  const id = String(value || '').trim();

  if (!id) {
    throw new Error(`${label} is required`);
  }

  return id;
}

async function readInstallationStore(root) {
  try {
    const parsed = JSON.parse(await readFile(getInstallationsPath(root), 'utf8'));
    return {
      accounts: parsed.accounts && typeof parsed.accounts === 'object'
        ? parsed.accounts
        : {}
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { accounts: {} };
    }

    throw error;
  }
}

async function writeInstallationStore(root, store) {
  const folder = path.dirname(getInstallationsPath(root));
  await mkdir(folder, { recursive: true });
  await writeFile(getInstallationsPath(root), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function readInstalledSkillIds(accountId, root = defaultInstallationsRoot) {
  const normalizedAccountId = normalizeId(accountId, 'accountId');
  const store = await readInstallationStore(root);
  const skillIds = Array.isArray(store.accounts[normalizedAccountId])
    ? store.accounts[normalizedAccountId]
    : [];

  return [...new Set(skillIds.map((skillId) => String(skillId).trim()).filter(Boolean))];
}

export async function installSkillForAccount(input, root = defaultInstallationsRoot) {
  const accountId = normalizeId(input?.accountId, 'accountId');
  const skillId = normalizeId(input?.skillId, 'skillId');
  const store = await readInstallationStore(root);
  const existing = Array.isArray(store.accounts[accountId])
    ? store.accounts[accountId]
    : [];

  store.accounts[accountId] = [...new Set([...existing, skillId])];
  await writeInstallationStore(root, store);

  return {
    accountId,
    skillIds: store.accounts[accountId]
  };
}
