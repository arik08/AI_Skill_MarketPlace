import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSkillForAccount, readInstalledSkillIds, removeSkillFromAllInstallations, uninstallSkillForAccount } from './lib/installations.js';
import { createSkillPackage, deleteSkillPackage, forkSkillPackage, readSkillCatalog, updateSkillFile } from './lib/skillCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(repoRoot, 'frontend');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '0.0.0.0';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': contentTypes['.json'] });
  response.end(JSON.stringify(payload, null, 2));
}

function sendApiError(response, error) {
  const statusCode = Number(error.statusCode || 500);
  sendJson(response, statusCode, {
    error: statusCode >= 500 ? 'Internal server error' : error.message
  });
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const body = await readFile(filePath);

  response.writeHead(200, {
    'content-type': contentTypes[extension] || 'application/octet-stream'
  });
  response.end(body);
}

async function handleApi(request, response, url) {
  // GET /api/health
  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'ai-skill-marketplace-backend'
    });
    return true;
  }

  // GET /api/skills
  if (request.method === 'GET' && url.pathname === '/api/skills') {
    sendJson(response, 200, await readSkillCatalog());
    return true;
  }

  // GET /api/installations
  if (request.method === 'GET' && url.pathname === '/api/installations') {
    const accountId = url.searchParams.get('accountId');

    if (!accountId) {
      sendJson(response, 400, { error: 'accountId is required' });
      return true;
    }

    sendJson(response, 200, {
      accountId,
      skillIds: await readInstalledSkillIds(accountId)
    });
    return true;
  }

  // POST /api/installations
  if (request.method === 'POST' && url.pathname === '/api/installations') {
    const installation = await installSkillForAccount(await readRequestJson(request));
    sendJson(response, 201, installation);
    return true;
  }

  // DELETE /api/installations
  if (request.method === 'DELETE' && url.pathname === '/api/installations') {
    const installation = await uninstallSkillForAccount(await readRequestJson(request));
    sendJson(response, 200, installation);
    return true;
  }

  // POST /api/skills
  if (request.method === 'POST' && url.pathname === '/api/skills') {
    const skill = await createSkillPackage(await readRequestJson(request));
    sendJson(response, 201, skill);
    return true;
  }

  const forkMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/fork$/);
  // POST /api/skills/:skillId/fork
  if (request.method === 'POST' && forkMatch) {
    const skill = await forkSkillPackage({
      ...await readRequestJson(request),
      skillId: decodeURIComponent(forkMatch[1])
    });
    sendJson(response, 201, skill);
    return true;
  }

  const skillMatch = url.pathname.match(/^\/api\/skills\/([^/]+)$/);
  // DELETE /api/skills/:skillId
  if (request.method === 'DELETE' && skillMatch) {
    const result = await deleteSkillPackage({
      ...await readRequestJson(request),
      skillId: decodeURIComponent(skillMatch[1])
    });
    await removeSkillFromAllInstallations(result.deletedSkillId);
    sendJson(response, 200, result);
    return true;
  }

  const fileMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/files$/);
  // PUT /api/skills/:skillId/files
  if (request.method === 'PUT' && fileMatch) {
    const result = await updateSkillFile({
      ...await readRequestJson(request),
      skillId: decodeURIComponent(fileMatch[1])
    });
    sendJson(response, 200, result);
    return true;
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found' });
    return true;
  }

  return false;
}

async function handleStatic(response, url) {
  const requestedPath = url.pathname === '/'
    ? 'index.html'
    : decodeURIComponent(url.pathname.slice(1));
  const resolvedPath = path.resolve(frontendRoot, requestedPath);

  if (!resolvedPath.startsWith(frontendRoot)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    await sendFile(response, resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Static fallback: frontend/index.html
      await sendFile(response, path.join(frontendRoot, 'index.html'));
      return;
    }

    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (await handleApi(request, response, url)) {
      return;
    }

    await handleStatic(response, url);
  } catch (error) {
    console.error(error);
    sendApiError(response, error);
  }
});

function getLanUrls() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((netInterface) => {
      return netInterface
        && netInterface.family === 'IPv4'
        && !netInterface.internal;
    })
    .map((netInterface) => `http://${netInterface.address}:${port}`);
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Set a different PORT value and try again.`);
    process.exit(1);
  }

  throw error;
});

server.listen(port, host, () => {
  console.log(`AI Skill Marketplace running on ${host}:${port}`);
  console.log(`Local: http://localhost:${port}`);

  for (const url of getLanUrls()) {
    console.log(`LAN:   ${url}`);
  }

  console.log('Share one of the LAN URLs with people on the same network.');
});
