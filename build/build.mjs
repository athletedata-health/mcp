#!/usr/bin/env node
// Renders every manifest in this repo from the constants below, so the copy,
// the endpoint and the per-platform signup links cannot drift between
// listings. Edit here, run `node build/build.mjs`, commit the output.
//
// `node build/build.mjs --check` exits non-zero if any generated file is out
// of date, or if any public copy breaks a house rule (no em dashes, the
// registry's 100-char description cap, every signup link tagged).

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

// ── facts ──────────────────────────────────────────────────────────────────
const VERSION = "1.0.0";
const NAME = "athletedata";
const REPO = "athletedata-health/mcp";
const REPO_URL = `https://github.com/${REPO}`;
const MCP_URL = "https://mcp.athletedata.health/mcp";
const SITE = "https://www.athletedata.health";
const KEY_PAGE = `${SITE}/dashboard/mcp`;
const ENV_VAR = "ATHLETEDATA_API_KEY";
const LOGO_URL = `${SITE}/logo-1024.png`;
const REGISTRY_NAME = "health.athletedata/mcp";

// Every listing links here with its own utm_source; `ref=mcp` puts the signup
// on the MCP plan (lib/signup-ref.ts), the UTMs land in users.acquisition_*.
const tag = (source) => `utm_source=${source}&utm_medium=mcp-directory`;
const signupUrl = (source) => `${SITE}/login?ref=mcp&${tag(source)}`;
const siteUrl = (source) => `${SITE}/mcp?${tag(source)}`;

const SHORT =
  "Your Garmin, Oura, WHOOP, Hevy and 35 more fitness apps, queryable from your own AI.";

const APPS = {
  "Activity and power":
    "Garmin, Wahoo, Intervals.icu, TrainingPeaks, Polar, COROS, Suunto, Zepp, Zwift, Rouvy, MyWhoosh, Peloton, TrainerRoad, Hammerhead Karoo, Concept2",
  "Sleep and recovery":
    "Oura, WHOOP, Ultrahuman, Garmin, Withings, Apple Health, Google Health (Fitbit, Pixel Watch), COROS, Suunto, Zepp, Eight Sleep",
  Heart: "Frontier X (ECG)",
  Strength: "Hevy, Strong, Fitbod, Technogym",
  Nutrition: "Cronometer, MyFitnessPal, Yazio, Lose It!, Lifesum, Fuelin",
  "Body composition": "Renpho, Withings",
  "Cycle tracking": "Clue, Flo",
  "Calendar and docs": "Google Calendar, Apple Calendar, Google Sheets",
};

const LONG = `athletedata is a hosted MCP server for athletes. Connect your training and health apps once at athletedata.health, then ask your own AI about your data.

It reads 39 apps and computes the numbers on top: training load (CTL, ATL, TSB), HRV and resting heart rate trends, readiness, sleep trends, power and pace curves, race predictions, intensity distribution and load spikes. With your permission it can also write back: push a structured workout to your Garmin or COROS (through Intervals.icu) or Apple Watch (through the athletedata iPhone app), log food, or create a Hevy routine.`;

const appsMarkdown = Object.entries(APPS)
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join("\n");

const STRAVA_NOTE =
  "Strava data is not available over MCP: Strava's API terms do not allow serving it to third-party AI tools.";

// ── the skill (ClawHub, Hermes, Cursor all load skills/*/SKILL.md) ─────────
function skillMd(source, { openclawMeta }) {
  const meta = openclawMeta
    ? `metadata: {"openclaw": {"emoji": "🏃", "homepage": "${siteUrl(source)}", "primaryEnv": "${ENV_VAR}", "requires": {"env": ["${ENV_VAR}"]}}}\n`
    : "";
  return `---
name: ${NAME}
description: Read the user's own training and health data (Garmin, Oura, WHOOP, Hevy, Apple Health, Intervals.icu and 33 more apps) through the athletedata MCP server. Use when the user asks about their workouts, training load, HRV, sleep, recovery, readiness, nutrition, body composition, race predictions, or wants a structured workout pushed to their watch.
${meta}---

# athletedata

athletedata is a hosted MCP server that gives you read access to one athlete's
own training and health data, collected from the apps they connected at
athletedata.health. Use it instead of guessing or asking the user to paste
numbers.

## Connect

The server is Streamable HTTP at \`${MCP_URL}\`.

- Clients that support MCP OAuth: add the URL with no credential and sign in
  when prompted.
- Everything else: send the athlete's API key as a header,
  \`Authorization: Bearer $${ENV_VAR}\`. The key starts with \`sk_soma_\`
  and lives at ${KEY_PAGE}.
- No account yet: ${signupUrl(source)} (7-day free trial).

OpenClaw:

\`\`\`bash
# Single quotes keep the placeholder in config; OpenClaw expands it at runtime.
openclaw mcp add ${NAME} --url ${MCP_URL} --transport streamable-http --header 'Authorization=Bearer \${${ENV_VAR}}' --no-probe
openclaw mcp probe ${NAME}
\`\`\`

Or sign in instead of using a key: \`--auth oauth\` in place of \`--header ...\`,
then \`openclaw mcp login ${NAME}\`.

Never print, log or echo the key back to the user.

## When to use it

- "How was my run yesterday?", "Am I recovered enough to do intervals today?"
- Trends: training load, HRV, resting heart rate, sleep, weight, VO2max.
- Planning: race predictions, goal reality checks, weather for a session.
- Doing: build a structured workout and push it to the athlete's watch, log a
  meal, create a Hevy routine. These write to the athlete's own accounts, so
  confirm the details with the user first.

## How to use it well

1. Start broad (\`get_analytics_summary\`, \`get_readiness_today\`,
   \`get_pmc_status\`), then drill into one activity or one provider's tools.
2. Tools are prefixed by source (\`garmin_\`, \`oura_\`, \`whoop_\`, \`hevy_\`,
   \`intervals_\`, ...). Only the athlete's connected apps return data; if a
   provider tool errors with "not connected", say so and use another source.
3. Dates are in the athlete's local time zone. Quote the numbers you got back
   rather than rounding them into vague words.
4. ${STRAVA_NOTE}
`;
}

// ── manifests ───────────────────────────────────────────────────────────────
const files = {};
const json = (o) => JSON.stringify(o, null, 2) + "\n";

// Official MCP Registry. The header is declared but NOT required, so a client
// that supports OAuth (VS Code, Claude) can sign in instead of asking for it.
files["server.json"] = json({
  $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name: REGISTRY_NAME,
  title: NAME,
  description: SHORT,
  version: VERSION,
  websiteUrl: siteUrl("mcp-registry"),
  repository: { url: REPO_URL, source: "github" },
  icons: [{ src: LOGO_URL, mimeType: "image/png", sizes: ["1024x1024"] }],
  remotes: [
    {
      type: "streamable-http",
      url: MCP_URL,
      headers: [
        {
          name: "Authorization",
          description: `Optional. Bearer + your athletedata API key (sk_soma_...) from ${KEY_PAGE}. Clients that support MCP OAuth can leave this out and sign in instead.`,
          isRequired: false,
          isSecret: true,
          placeholder: "Bearer sk_soma_...",
        },
      ],
    },
  ],
});

// Agent Plugins v1 (Hermes reads these; Cursor loads a root plugin.json too).
files["plugin.json"] = json({
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: NAME,
  version: VERSION,
  description: SHORT,
  author: { name: "athletedata", email: "team@athletedata.health", url: SITE },
  homepage: siteUrl("hermes"),
  repository: REPO_URL,
  license: "MIT",
  keywords: ["mcp", "fitness", "training", "garmin", "oura", "whoop", "health", "running", "cycling"],
  // Hermes asks the user before any write tool runs (watch push, food log).
  extensions: { "com.nousresearch.hermes": { servers: { [NAME]: { trust: "untrusted" } } } },
});

files["mcp.json"] = json({
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: {
    [NAME]: {
      type: "streamable-http",
      url: MCP_URL,
      headers: { Authorization: `Bearer \${${ENV_VAR}}` },
    },
  },
});

// Cursor plugin (cursor.directory reads .cursor-plugin/ before a root
// plugin.json; the Marketplace accepts either). `variables` declares the key
// that the root mcp.json's ${ATHLETEDATA_API_KEY} placeholder needs.
files[".cursor-plugin/plugin.json"] = json({
  name: NAME,
  version: VERSION,
  description: SHORT,
  author: { name: "athletedata", email: "team@athletedata.health" },
  homepage: siteUrl("cursor"),
  repository: REPO_URL,
  license: "MIT",
  logo: "assets/logo.png",
  keywords: ["mcp", "fitness", "training", "garmin", "oura", "whoop", "health"],
  skills: "./skills/",
  mcpServers: "./mcp.json",
  variables: {
    type: "object",
    properties: {
      [ENV_VAR]: {
        type: "string",
        title: "athletedata API key",
        description: `Your sk_soma_... key from ${KEY_PAGE}`,
      },
    },
    required: [ENV_VAR],
  },
});

// Gemini CLI extension. `settings` makes `gemini extensions install` prompt
// for the key and keep it in the system keychain.
files["gemini-extension.json"] = json({
  name: NAME,
  version: VERSION,
  description: SHORT,
  contextFileName: "GEMINI.md",
  mcpServers: {
    [NAME]: {
      httpUrl: MCP_URL,
      headers: { Authorization: `Bearer \${${ENV_VAR}}` },
    },
  },
  settings: [
    {
      name: "athletedata API key",
      description: `Your sk_soma_... key from ${KEY_PAGE} (no account yet? ${signupUrl("gemini-cli")})`,
      envVar: ENV_VAR,
      sensitive: true,
    },
  ],
});

files["GEMINI.md"] = `# athletedata

The \`athletedata\` MCP server holds this user's own training and health data
from the apps they connected at athletedata.health (Garmin, Oura, WHOOP, Hevy,
Apple Health, Intervals.icu and more). When they ask about their workouts,
training load, HRV, sleep, recovery, readiness, nutrition or race predictions,
call its tools instead of guessing or asking them to paste numbers.

- Start broad (\`get_analytics_summary\`, \`get_readiness_today\`,
  \`get_pmc_status\`), then drill into one activity or provider.
- Provider tools are prefixed (\`garmin_\`, \`oura_\`, \`whoop_\`, ...); only
  connected apps return data.
- Tools that write (\`push_workout_to_watch\`, \`food_log_entry\`,
  \`hevy_create_routine\`, ...) change the user's own accounts. Confirm first.
- ${STRAVA_NOTE}
`;

// Glama: lets the maintainers claim the listing once Glama ingests it.
files["glama.json"] = json({
  $schema: "https://glama.ai/mcp/schemas/server.json",
  maintainers: ["fliellerjulian"],
});

files["skills/athletedata/SKILL.md"] = skillMd("agent-skill", { openclawMeta: false });
// ClawHub publishes from its own folder so its signup link carries its own tag.
files["clawhub/athletedata/SKILL.md"] = skillMd("clawhub", { openclawMeta: true });

// ── README ──────────────────────────────────────────────────────────────────
const cursorConfig = Buffer.from(JSON.stringify({ url: MCP_URL })).toString("base64");
const cursorInstall = `https://cursor.com/en/install-mcp?name=${NAME}&config=${encodeURIComponent(cursorConfig)}`;
const vscodeConfig = JSON.stringify({ name: NAME, type: "http", url: MCP_URL });

files["README.md"] = `<p align="center"><img src="assets/logo.png" width="96" alt="athletedata"></p>

# athletedata MCP server

${SHORT}

${LONG}

**Server:** \`${MCP_URL}\` (Streamable HTTP)
**Account:** [start a 7-day free trial](${signupUrl("github")}), then find your key at [${KEY_PAGE.replace("https://", "")}](${KEY_PAGE}).
**More:** [athletedata.health/mcp](${siteUrl("github")})

## What it reads

${appsMarkdown}

${STRAVA_NOTE}

## Two ways to sign in

1. **OAuth (recommended where the client supports it).** Add the bare URL
   \`${MCP_URL}\` and sign in with your athletedata account. The consent
   screen lists what the app asked for, and you can revoke it any time under
   Settings, Connected apps.
2. **API key.** Send \`Authorization: Bearer sk_soma_...\` with every request.
   The key is on [your MCP page](${KEY_PAGE}). Treat it like a password.

## Setup by client

### Claude (claude.ai, Claude Desktop)

Settings, Connectors, **Add custom connector**, paste \`${MCP_URL}\`, then sign in.
Guide: [athletedata.health/mcp/setup/claude-desktop](${SITE}/mcp/setup/claude-desktop?${tag("claude")})
No account yet? [Start free](${signupUrl("claude")}).

### Claude Code

\`\`\`bash
claude mcp add --transport http ${NAME} ${MCP_URL}
\`\`\`

Then run \`/mcp\` inside Claude Code and sign in. No account yet? [Start free](${signupUrl("claude-code")}).

### ChatGPT

Guide: [athletedata.health/mcp/setup/chatgpt](${SITE}/mcp/setup/chatgpt?${tag("chatgpt")})
No account yet? [Start free](${signupUrl("chatgpt")}).

### Cursor

[![Add athletedata to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](${cursorInstall})

The button adds the server and Cursor asks you to sign in. To use a key
instead, put this in \`~/.cursor/mcp.json\` and set \`${ENV_VAR}\` in your environment:

\`\`\`json
{
  "mcpServers": {
    "${NAME}": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer \${env:${ENV_VAR}}" }
    }
  }
}
\`\`\`

This repo is also a Cursor plugin (\`.cursor-plugin/plugin.json\`).
No account yet? [Start free](${signupUrl("cursor")}).

### VS Code (GitHub Copilot)

\`\`\`bash
code --add-mcp '${vscodeConfig}'
\`\`\`

VS Code asks you to sign in on first use. No account yet? [Start free](${signupUrl("vscode")}).

### Gemini CLI

\`\`\`bash
gemini extensions install ${REPO_URL}
\`\`\`

The installer asks for your API key and keeps it in your system keychain.
No account yet? [Start free](${signupUrl("gemini-cli")}).

### OpenClaw

Sign in with OAuth:

\`\`\`bash
openclaw mcp add ${NAME} --url ${MCP_URL} --transport streamable-http --auth oauth
openclaw mcp login ${NAME}
\`\`\`

Or with a key (set \`${ENV_VAR}\` in your environment; single quotes keep the
placeholder in config, and \`--no-probe\` is needed because the add-time probe
does not expand it):

\`\`\`bash
openclaw mcp add ${NAME} --url ${MCP_URL} --transport streamable-http --header 'Authorization=Bearer \${${ENV_VAR}}' --no-probe
openclaw mcp probe ${NAME}
\`\`\`

The matching skill tells your agent when to reach for it: \`clawhub install ${NAME}\`.
No account yet? [Start free](${signupUrl("openclaw")}).

### Hermes Agent

\`\`\`bash
echo '${ENV_VAR}=sk_soma_...' >> ~/.hermes/.env
hermes plugins install ${REPO}
hermes plugins enable ${NAME}
\`\`\`

No account yet? [Start free](${signupUrl("hermes")}).

### Mistral Le Chat

Connectors, **Add connector**, Custom MCP connector, paste \`${MCP_URL}\`, then sign in.
No account yet? [Start free](${signupUrl("mistral")}).

### Any other MCP client

URL \`${MCP_URL}\`, transport Streamable HTTP, header \`Authorization: Bearer sk_soma_...\`.
Clients that only speak stdio can bridge with \`npx mcp-remote ${MCP_URL} --header "Authorization:Bearer \${${ENV_VAR}}"\`.

## What is in this repo

Manifests only. The server itself is hosted by athletedata; nothing here runs on your machine.

| File | For |
|---|---|
| \`server.json\` | [Official MCP Registry](https://registry.modelcontextprotocol.io) |
| \`gemini-extension.json\`, \`GEMINI.md\` | Gemini CLI extension |
| \`plugin.json\`, \`mcp.json\`, \`skills/\` | Agent Plugins package (Hermes Agent, Cursor) |
| \`.cursor-plugin/plugin.json\` | Cursor plugin |
| \`clawhub/athletedata/SKILL.md\` | ClawHub skill for OpenClaw |
| \`glama.json\` | Glama listing ownership |
| \`build/build.mjs\` | Renders all of the above from one source |

## Privacy

Your data stays yours: we do not sell it and do not train models on it, and you can delete everything from the dashboard. Details: [athletedata.health/trust](${SITE}/trust).
Questions: team@athletedata.health

Made by HealthspanOS AG, Zurich.
`;

files["LICENSE"] = `MIT License

Copyright (c) 2026 HealthspanOS AG

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

// ── house rules ─────────────────────────────────────────────────────────────
const problems = [];
if (SHORT.length > 100) problems.push(`registry description is ${SHORT.length} chars (max 100)`);
for (const [path, body] of Object.entries(files)) {
  if (body.includes("—")) problems.push(`${path}: contains an em dash`);
  for (const m of body.matchAll(/https:\/\/www\.athletedata\.health\/(login|mcp)[^\s)"'`]*/g)) {
    const url = m[0];
    if (/\/mcp\/setup\/|\/mcp\?|\/login\?/.test(url) && !url.includes("utm_medium=mcp-directory"))
      problems.push(`${path}: untagged link ${url}`);
    if (url.includes("/login") && !url.includes("ref=mcp")) problems.push(`${path}: signup link without ref=mcp ${url}`);
  }
}

let stale = 0;
for (const [path, body] of Object.entries(files)) {
  const full = join(ROOT, path);
  const current = existsSync(full) ? readFileSync(full, "utf8") : null;
  if (current === body) continue;
  if (CHECK) {
    stale++;
    console.error(`out of date: ${path}`);
  } else {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
    console.log(`wrote ${path}`);
  }
}
for (const p of problems) console.error(`rule: ${p}`);
if (problems.length || stale) process.exit(1);
