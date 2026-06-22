import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(repoRoot, 'frontend');
const port = Number(process.env.PORT || 5173);

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
    await sendFile(response, path.join(__dirname, 'data', 'skills.json'));
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
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`AI Skill Marketplace running at http://localhost:${port}`);
});
