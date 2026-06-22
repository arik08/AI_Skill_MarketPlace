# AI Skill Marketplace

AI skill marketplace prototype for registering, browsing, and testing reusable work skills.

## Project Structure

```text
backend/
  lib/
    skillCatalog.js      # Loads skill packages from skills/
  server.js              # Node HTTP server and API placeholders
frontend/
  index.html             # App shell and markup
  src/
    app.js               # UI state, filtering, detail view, modal flow
    styles.css           # Shared styles extracted from the prototype
    data/
      mockSkills.js      # Frontend mock skill catalog
      mockFileContents.js # Frontend mock detail/file contents
tests/
  project-structure.test.js
skills/
  official/
    investment/
      investment-feasibility-review/
        SKILL.md                 # Codex skill entrypoint
        skill.json               # Marketplace manifest
        agents/openai.yaml       # Optional UI/agent metadata
        references/input.schema.json
        examples/sample-input.json
  imported/
    user-drop/
      external-skill/
        SKILL.md
  drafts/
```

## Run Locally

```bash
npm start
```

Open `http://localhost:5173`.

On Windows, you can also use:

```text
Install.bat
run.bat
```

`run.bat` starts the server on `0.0.0.0:5173` and prints LAN URLs such as `http://192.168.x.x:5173` for people on the same company network.

## Test

```bash
npm test
```

## Current Status

- Frontend and backend are separated.
- The backend serves `GET /api/skills` by recursively reading real skill package folders under `skills/`.
- The frontend loads skills from `/api/skills` and only uses local mock data as a fallback when the API is unavailable.
- Skill folders can live anywhere below `skills/`; folder paths are for human organization, and skill identity comes from `skill.json` or `SKILL.md`.

## Add A Real Skill

Drop a skill folder anywhere under `skills/`. A full marketplace-managed skill uses this shape:

```text
skills/official/finance/my-skill-id/
  SKILL.md
  skill.json
  agents/openai.yaml
  references/input.schema.json
  examples/sample-input.json
```

An external skill can start with only:

```text
skills/imported/vendor-a/external-skill/
  SKILL.md
```

The catalog will still show it with default metadata. Later, when marketplace fields are edited, the system can write or update that folder's `skill.json` without changing the skill's location.
