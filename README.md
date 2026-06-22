# AI Skill Marketplace

AI skill marketplace prototype for registering, browsing, and testing reusable work skills.

## Project Structure

```text
backend/
  data/
    skills.json          # Backend seed data for API responses
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
```

## Run Locally

```bash
npm start
```

Open `http://localhost:5173`.

## Test

```bash
npm test
```

## Current Status

- Frontend and backend are separated.
- The current UI still uses frontend mock data for interaction speed.
- The backend already serves `GET /api/health` and `GET /api/skills` as stable starting points for future real data integration.
