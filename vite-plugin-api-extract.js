// vite-plugin-api-extract.js
// Vite plugin that promotes a tracker's bundled data exports to flat JSON files
// under <outDir>/api/v1/<resource>.json, plus a manifest at index.json.
//
// Lives canonically in nnnsightnnn/tracker-shared. Each tracker repo vendors
// a copy at its project root (cheap to sync; one file).
//
// Usage in vite.config.js:
//
//   import apiExtract from './vite-plugin-api-extract.js';
//
//   export default {
//     base: '/liverpool-tracker/',
//     plugins: [
//       react(),
//       apiExtract({
//         tracker: 'liverpool',
//         team: { name: 'Liverpool FC', abbreviation: 'LIV' },
//         league: 'EPL',
//         sources: [
//           { from: './src/playerData.js', exportName: 'PLAYERS', resource: 'squad' },
//           { from: './src/lineupData.js', exportName: ['FORMATIONS', 'ALTERNATIVES', 'PREDICTION_NOTE'], resource: 'lineup' },
//         ],
//       }),
//     ],
//   };

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const VERSION = 'v1';

function safeJsonReplacer(_key, value) {
  // Drop functions / undefined / DOM-ish refs; coerce Dates to ISO.
  if (typeof value === 'function') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return Object.fromEntries(value);
  if (value instanceof Set) return Array.from(value);
  return value;
}

function gitShortSha(cwd) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export default function apiExtract(options) {
  const {
    tracker,
    team,
    league,
    sources = [],
  } = options || {};

  if (!tracker) throw new Error('[api-extract] options.tracker is required');
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('[api-extract] options.sources must be a non-empty array');
  }

  let outDir;
  let basePath;
  let projectRoot;

  return {
    name: 'api-extract',
    apply: 'build',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      basePath = (config.base || '/').replace(/\/+$/, ''); // strip trailing slash
      projectRoot = config.root;
    },

    async closeBundle() {
      const apiDir = join(outDir, 'api', VERSION);
      await mkdir(apiDir, { recursive: true });

      const generatedAt = new Date().toISOString();
      const commit = gitShortSha(projectRoot);
      const endpoints = [];

      for (const src of sources) {
        const { from, exportName, resource } = src;
        if (!from || !exportName || !resource) {
          this.warn(`[api-extract] skipping malformed source entry: ${JSON.stringify(src)}`);
          continue;
        }

        const absPath = resolve(projectRoot, from);
        const moduleUrl = pathToFileURL(absPath).href + `?t=${Date.now()}`; // bust ESM cache
        let mod;
        try {
          mod = await import(moduleUrl);
        } catch (err) {
          this.warn(`[api-extract] failed to import ${from}: ${err.message}`);
          continue;
        }

        let payload;
        if (Array.isArray(exportName)) {
          payload = {};
          for (const name of exportName) {
            if (mod[name] === undefined) {
              this.warn(`[api-extract] export "${name}" missing in ${from}`);
              continue;
            }
            payload[name] = mod[name];
          }
        } else {
          if (mod[exportName] === undefined) {
            this.warn(`[api-extract] export "${exportName}" missing in ${from}`);
            continue;
          }
          payload = mod[exportName];
        }

        const filePath = join(apiDir, `${resource}.json`);
        let json;
        try {
          json = JSON.stringify(payload, safeJsonReplacer, 2);
        } catch (err) {
          this.warn(`[api-extract] failed to serialize ${resource}: ${err.message}`);
          continue;
        }

        await writeFile(filePath, json + '\n', 'utf8');
        const publicPath = `${basePath}/api/${VERSION}/${resource}.json`;
        endpoints.push({ path: publicPath, resource, lastUpdated: generatedAt });
        this.info?.(`[api-extract] wrote ${publicPath} (${(json.length / 1024).toFixed(1)} KB)`);
      }

      const manifest = {
        tracker,
        league: league || null,
        team: team || null,
        version: VERSION,
        generatedAt,
        commit,
        endpoints,
      };
      const manifestPath = join(apiDir, 'index.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      const manifestPublicPath = `${basePath}/api/${VERSION}/index.json`;
      this.info?.(`[api-extract] wrote ${manifestPublicPath} with ${endpoints.length} endpoints`);
    },
  };
}
