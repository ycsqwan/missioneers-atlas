#!/usr/bin/env node
/**
 * Missioneers' Atlas — Data Build Pipeline
 * 
 * Regenerates all JSON data files from SDE + optional ESI fetches.
 * 
 * Usage:
 *   node build.mjs --sde <path-to-sde-jsonl-dir> [--out <output-dir>] [--esi] [--only <name>]
 * 
 * Options:
 *   --sde   Path to SDE JSONL directory (required)
 *   --out   Output directory (default: parent of this script = project root)
 *   --esi   Also fetch ESI-based data (station_names, lp_offers_cache)
 *   --only  Build only one file: systems|missions|types|agents|sde|hubs|stations|lp
 * 
 * Examples:
 *   node build.mjs --sde G:/eve-online-static-data-3500372-jsonl
 *   node build.mjs --sde G:/eve-online-static-data-3500372-jsonl --esi
 *   node build.mjs --sde G:/eve-online-static-data-3500372-jsonl --only systems
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Parse CLI args ──
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}
const hasFlag = (name) => args.includes(name);

const SDE_DIR = getArg('--sde');
const OUT_DIR = resolve(getArg('--out') || join(__dirname, '..'));
const DO_ESI = hasFlag('--esi');
const ONLY = getArg('--only');

if (!SDE_DIR) {
  console.error('Usage: node build.mjs --sde <path-to-sde-jsonl-dir> [--out <dir>] [--esi] [--only <name>]');
  console.error('');
  console.error('Build targets: systems, missions, types, agents, sde, hubs, stations, lp');
  process.exit(1);
}

// ── Helpers ──
function readJsonl(filename) {
  const path = join(SDE_DIR, filename);
  const text = readFileSync(path, 'utf8');
  const result = [];
  for (const line of text.split('\n')) {
    if (line.trim()) result.push(JSON.parse(line));
  }
  return result;
}

function readJsonlMap(filename) {
  const map = {};
  for (const d of readJsonl(filename)) {
    map[d._key] = d;
  }
  return map;
}

function nameStr(nameObj) {
  if (typeof nameObj === 'string') return { en: nameObj, zh: '' };
  if (nameObj && typeof nameObj === 'object') {
    return { en: nameObj.en || '', zh: nameObj.zh || '' };
  }
  return { en: '', zh: '' };
}

function writeJson(filename, data) {
  const path = join(OUT_DIR, filename);
  const json = JSON.stringify(data);
  writeFileSync(path, json, 'utf8');
  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(0);
  console.log(`  ✓ ${filename} (${sizeKB} KB)`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: {
      'User-Agent': 'MissioneersAtlas-Builder/1.0',
      'Accept': 'application/json',
    }}, (res) => {
      if (res.statusCode === 429) {
        const retry = parseInt(res.headers['retry-after'] || '5', 10);
        console.log(`    ⏳ Rate limited, waiting ${retry}s...`);
        setTimeout(() => httpGet(url).then(resolve).catch(reject), retry * 1000);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════════
// Build 1: systems_static.json
// ═══════════════════════════════════════════════════════════════════════
function buildSystems() {
  console.log('\n[1] Building systems_static.json ...');
  const t0 = Date.now();

  const systems = readJsonlMap('mapSolarSystems.jsonl');
  const consts = readJsonlMap('mapConstellations.jsonl');
  const regions = readJsonlMap('mapRegions.jsonl');
  const stargates = readJsonlMap('mapStargates.jsonl');
  const stations = readJsonlMap('npcStations.jsonl');

  console.log(`  Loaded: ${Object.keys(systems).length} systems, ${Object.keys(consts).length} constellations, ${Object.keys(regions).length} regions`);

  // Station → system
  const stationsBySystem = {};
  for (const [stnId, stn] of Object.entries(stations)) {
    const sid = stn.solarSystemID;
    if (!sid) continue;
    if (!stationsBySystem[sid]) stationsBySystem[sid] = [];
    stationsBySystem[sid].push({
      id: parseInt(stnId),
      ownerID: stn.ownerID,
      typeID: stn.typeID,
      reprocessingEfficiency: stn.reprocessingEfficiency,
      reprocessingStationsTake: stn.reprocessingStationsTake,
    });
  }

  // Stargate neighbors
  const neighborsBySystem = {};
  for (const sg of Object.values(stargates)) {
    const src = sg.solarSystemID;
    const dst = sg.destination?.solarSystemID;
    if (src && dst && src !== dst) {
      if (!neighborsBySystem[src]) neighborsBySystem[src] = new Set();
      neighborsBySystem[src].add(dst);
    }
  }

  // Constellation/Region names
  const constNames = {};
  for (const [cid, c] of Object.entries(consts)) {
    constNames[cid] = nameStr(c.name);
  }
  const regionNames = {};
  const regionFactions = {};
  for (const [rid, r] of Object.entries(regions)) {
    regionNames[rid] = nameStr(r.name);
    regionFactions[rid] = r.factionID || 0;
  }

  // Build records
  const out = {};
  for (const [sysId, sys] of Object.entries(systems)) {
    const cid = sys.constellationID || 0;
    const rid = sys.regionID || 0;
    const pos = sys.position || {};
    out[sysId] = {
      id: parseInt(sysId),
      name: nameStr(sys.name),
      constellationID: cid,
      constellationName: constNames[cid] || { en: '', zh: '' },
      regionID: rid,
      regionName: regionNames[rid] || { en: '', zh: '' },
      regionFactionID: regionFactions[rid] || 0,
      securityStatus: Math.round((sys.securityStatus || 0) * 10000) / 10000,
      securityClass: sys.securityClass || '',
      position: { x: pos.x || 0, y: pos.y || 0, z: pos.z || 0 },
      position2D: sys.position2D || {},
      stargateIDs: sys.stargateIDs || [],
      neighborIDs: [...(neighborsBySystem[sysId] || [])].sort((a, b) => a - b),
      stations: stationsBySystem[sysId] || [],
      planetCount: (sys.planetIDs || []).length,
      isBorder: sys.border || false,
      isHub: sys.hub || false,
      isRegional: sys.regional || false,
      isInternational: sys.international || false,
    };
  }

  // Name → ID reverse lookup
  const nameToId = {};
  for (const [sysId, rec] of Object.entries(out)) {
    for (const lang of ['en', 'zh']) {
      const nm = rec.name[lang];
      if (nm) nameToId[nm.toLowerCase()] = parseInt(sysId);
    }
  }

  // Detect SDE build number from directory name or _sde.jsonl
  let sdeBuild = 'unknown';
  const sdeMatch = SDE_DIR.match(/(\d{5,})/);
  if (sdeMatch) sdeBuild = sdeMatch[1];

  const payload = {
    version: 1,
    sde_build: sdeBuild,
    description: 'Static solar system topology (SDE only, no ESI)',
    system_count: Object.keys(out).length,
    built_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    name_to_id: nameToId,
    systems: out,
  };

  writeJson('systems_static.json', payload);
  console.log(`  ${Object.keys(out).length} systems in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 2: missions_data.json
// ═══════════════════════════════════════════════════════════════════════
function buildMissions() {
  console.log('\n[2] Building missions_data.json ...');
  const t0 = Date.now();

  const missionsById = {};
  const missionsByName = { en: {}, zh: {} };

  for (const d of readJsonl('missions.jsonl')) {
    const id = d._key;
    // Compact messages: keep name/speaker/desc snippet only
    const messages = (d.messages || []).map(msg => {
      const m = { _key: msg._key };
      if (msg.name) m.name = { en: msg.name.en || '', zh: msg.name.zh || '' };
      if (msg.speaker) m.speaker = msg.speaker;
      if (msg.description) {
        const en = (msg.description.en || '').replace(/<[^>]+>/g, '').slice(0, 300);
        const zh = (msg.description.zh || '').replace(/<[^>]+>/g, '').slice(0, 300);
        if (en || zh) m.desc = { en, zh };
      }
      return m;
    });

    missionsById[id] = {
      id,
      name: d.name || {},
      killMission: d.killMission || null,
      courierMission: d.courierMission || null,
      epicArcMission: d.epicArcMission || null,
      hasStandingRewards: d.hasStandingRewards || false,
      factionID: d.factionID || null,
      corporationID: d.corporationID || null,
      messages,
    };

    const nm = d.name || {};
    for (const lang of ['en', 'zh']) {
      const val = nm[lang];
      if (!val) continue;
      const key = val.toLowerCase();
      if (!missionsByName[lang][key]) missionsByName[lang][key] = [];
      missionsByName[lang][key].push(id);
    }
  }

  const count = Object.keys(missionsById).length;
  writeJson('missions_data.json', { missionsById, missionsByName, _meta: { count } });
  console.log(`  ${count} missions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 3: types_names.json
// ═══════════════════════════════════════════════════════════════════════
function buildTypesNames() {
  console.log('\n[3] Building types_names.json ...');
  const t0 = Date.now();

  const typesNames = {};
  for (const d of readJsonl('types.jsonl')) {
    const nm = d.name || {};
    const en = nm.en || '';
    const zh = nm.zh || '';
    if (en || zh) typesNames[d._key] = { en, zh };
  }

  const count = Object.keys(typesNames).length;
  writeJson('types_names.json', typesNames);
  console.log(`  ${count} types in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 4: agent_types.json + agent_divisions.json
// ═══════════════════════════════════════════════════════════════════════
function buildAgentMeta() {
  console.log('\n[4] Building agent_types.json + agent_divisions.json ...');

  const agentTypes = {};
  for (const d of readJsonl('agentTypes.jsonl')) {
    agentTypes[d._key] = d.name || '';
  }
  writeJson('agent_types.json', agentTypes);

  const divisions = {};
  for (const d of readJsonl('npcCorporationDivisions.jsonl')) {
    const nm = d.name || {};
    divisions[d._key] = {
      en: nm.en || d.displayName || d.internalName || '',
      zh: nm.zh || '',
      internalName: d.internalName || '',
    };
  }
  writeJson('agent_divisions.json', divisions);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 5: sde_data.json (agentsByLocation, stationsById, corpsById, etc.)
// ═══════════════════════════════════════════════════════════════════════
function buildSdeData() {
  console.log('\n[5] Building sde_data.json ...');
  const t0 = Date.now();

  // ── Agents ──
  const agentsByLocation = {};
  const agentTypesById = {};
  for (const d of readJsonl('agentTypes.jsonl')) {
    agentTypesById[d._key] = {
      id: d._key,
      name: d.name || '',
      isFactionalWarfare: d.isFactionalWarfare || false,
    };
  }

  for (const d of readJsonl('npcCharacters.jsonl')) {
    if (!d.agent) continue;
    const locId = d.locationID;
    if (!locId) continue;
    const nm = d.name || {};
    const agent = {
      id: d._key,
      name: nm.en || '',
      nameZh: nm.zh || '',
      corpID: d.corporationID || 0,
      level: d.agent.level || 0,
      agentTypeID: d.agent.agentTypeID || 0,
      divisionID: d.agent.divisionID || 0,
      isLocator: d.agent.isLocator || false,
      quality: d.agent.quality ?? null,
    };
    if (!agentsByLocation[locId]) agentsByLocation[locId] = [];
    agentsByLocation[locId].push(agent);
  }

  // ── Stations ──
  const stationsById = {};
  // Load type names for station name resolution
  const typeNames = {};
  for (const d of readJsonl('types.jsonl')) {
    const nm = d.name || {};
    typeNames[d._key] = { en: nm.en || '', zh: nm.zh || '' };
  }

  for (const d of readJsonl('npcStations.jsonl')) {
    const tid = d.typeID;
    const tn = typeNames[tid] || { en: '?', zh: '' };
    stationsById[d._key] = {
      id: d._key,
      name: tn.en,
      nameZh: tn.zh,
      solarSystemID: d.solarSystemID || 0,
      typeID: tid,
      reprocessingEfficiency: d.reprocessingEfficiency || 0,
      reprocessingStationsTake: d.reprocessingStationsTake || 0,
      services: d.services || [],
    };
  }

  // ── Corporations (NPC only) ──
  const corpsById = {};
  for (const d of readJsonl('npcCorporations.jsonl')) {
    const nm = d.name || {};
    corpsById[d._key] = {
      id: d._key,
      name: nm.en || '',
      nameZh: nm.zh || '',
      factionID: d.factionID ?? null,
      memberCount: d.memberCount ?? null,
      size: d.size || '',
      extent: d.extent || '',
      solarSystemID: d.solarSystemID ?? null,
      stationID: d.stationID ?? null,
      description: (d.description?.en || '').slice(0, 300),
    };
  }

  // ── Factions ──
  const factionsById = {};
  for (const d of readJsonl('factions.jsonl')) {
    const nm = d.name || {};
    factionsById[d._key] = {
      id: d._key,
      name: nm.en || '',
      nameZh: nm.zh || '',
      shortName: d.shortName || '',
      corporationID: d.corporationID ?? null,
      militiaCorporationID: d.militiaCorporationID ?? null,
      sizeFactor: d.sizeFactor || 0,
      stationCount: d.stationCount ?? null,
      stationSystemCount: d.stationSystemCount ?? null,
    };
  }

  // ── Mission count (from missions.jsonl) ──
  let missionCount = 0;
  for (const _ of readJsonl('missions.jsonl')) missionCount++;

  const agentCount = Object.values(agentsByLocation).reduce((s, a) => s + a.length, 0);

  writeJson('sde_data.json', {
    agentsByLocation,
    stationsById,
    corpsById,
    factionsById,
    agentTypesById,
    _meta: {
      agentCount,
      stationCount: Object.keys(stationsById).length,
      corpCount: Object.keys(corpsById).length,
      factionCount: Object.keys(factionsById).length,
      missionCount,
    },
  });
  console.log(`  ${agentCount} agents, ${Object.keys(stationsById).length} stations, ${Object.keys(corpsById).length} corps, ${Object.keys(factionsById).length} factions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 6: mission_hubs.json (Top 200 mission-dense systems)
// ═══════════════════════════════════════════════════════════════════════
function buildMissionHubs() {
  console.log('\n[6] Building mission_hubs.json ...');
  const t0 = Date.now();

  // Agent type IDs for mission agents (not locator, not unknown)
  // 2=Security, 3=Trade, 4=Mining, 5=R&D, 6=Courier, 7=Distribution,
  // 8=Exploration, 9=Industry, 10=Factional Warfare, 13=Storyline
  const VALID_TYPES = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13]);

  const hubData = {}; // sysId → { levels: {}, types: {} }

  for (const d of readJsonl('npcCharacters.jsonl')) {
    if (!d.agent) continue;
    const agentType = d.agent.agentTypeID || 0;
    if (!VALID_TYPES.has(agentType)) continue;
    // Note: do NOT exclude isLocator — original mission_hubs.json includes them

    const locId = d.locationID;
    if (!locId) continue;

    // Resolve system from station
    // We need station→system mapping
    // For efficiency, we'll build it once
    if (!buildMissionHubs._stnToSys) {
      buildMissionHubs._stnToSys = {};
      for (const stn of readJsonl('npcStations.jsonl')) {
        if (stn.solarSystemID) {
          buildMissionHubs._stnToSys[stn._key] = stn.solarSystemID;
        }
      }
    }

    const sysId = buildMissionHubs._stnToSys[locId];
    if (!sysId) continue;

    if (!hubData[sysId]) hubData[sysId] = { levels: {}, types: {} };
    const hd = hubData[sysId];

    const lvl = d.agent.level || 0;
    hd.levels[lvl] = (hd.levels[lvl] || 0) + 1;
    hd.types[agentType] = (hd.types[agentType] || 0) + 1;
  }

  // Build sorted array
  const hubs = Object.entries(hubData)
    .map(([sysId, data]) => {
      const total = Object.values(data.levels).reduce((s, v) => s + v, 0);
      return {
        sysId: parseInt(sysId),
        agents: total,
        byLevel: [
          data.levels[1] || 0,
          data.levels[2] || 0,
          data.levels[3] || 0,
          data.levels[4] || 0,
          data.levels[5] || 0,
        ],
        byType: data.types,
      };
    })
    .sort((a, b) => b.agents - a.agents)
    .slice(0, 200);

  writeJson('mission_hubs.json', hubs);
  console.log(`  Top ${hubs.length} hubs (max ${hubs[0]?.agents || 0} agents) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 7: station_names.json (ESI — must use --esi flag)
// ═══════════════════════════════════════════════════════════════════════
async function buildStationNames() {
  console.log('\n[7] Fetching station_names.json from ESI ...');
  const t0 = Date.now();

  const stations = readJsonl('npcStations.jsonl');
  const stationIds = stations.map(s => s._key);
  console.log(`  ${stationIds.length} stations to fetch`);

  const names = {};
  let fetched = 0;
  let errors = 0;

  // Fetch in batches of 20 with delay
  const BATCH = 20;
  for (let i = 0; i < stationIds.length; i += BATCH) {
    const batch = stationIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(id =>
        httpGet(`https://esi.evetech.net/latest/universe/stations/${id}/`)
          .then(data => ({ id, name: data.name || `Station #${id}` }))
      )
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        names[r.value.id] = r.value.name;
        fetched++;
      } else {
        errors++;
      }
    }

    if (i % 200 === 0 && i > 0) {
      console.log(`  ${fetched}/${stationIds.length} fetched (${errors} errors)`);
    }
    await sleep(200); // ~5 req/s, well under ESI limit
  }

  writeJson('station_names.json', names);
  console.log(`  ${fetched} stations, ${errors} errors in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Build 8: lp_offers_cache.json (ESI — must use --esi flag)
// ═══════════════════════════════════════════════════════════════════════
async function buildLpOffers() {
  console.log('\n[8] Fetching lp_offers_cache.json from ESI ...');
  const t0 = Date.now();

  // Get all NPC corp IDs
  const corps = readJsonl('npcCorporations.jsonl');
  const corpIds = corps.map(c => c._key);

  // Also get corp names
  const corpNames = {};
  for (const c of corps) {
    const nm = c.name || {};
    corpNames[c._key] = nm.en || `Corp #${c._key}`;
  }

  console.log(`  ${corpIds.length} NPC corporations to check`);

  // Fetch LP offers for each corp
  const offersByType = {}; // typeId → [offers]
  let corpsWithOffers = 0;
  let totalOffers = 0;

  for (let i = 0; i < corpIds.length; i++) {
    const corpId = corpIds[i];
    try {
      const offers = await httpGet(`https://esi.evetech.net/latest/loyalty/stores/${corpId}/offers/`);
      if (Array.isArray(offers) && offers.length > 0) {
        corpsWithOffers++;
        for (const offer of offers) {
          const tid = offer.type_id;
          if (!offersByType[tid]) offersByType[tid] = [];
          offersByType[tid].push({
            corpID: corpId,
            lpCost: offer.lp_cost,
            iskCost: offer.isk_cost,
            quantity: offer.quantity || 1,
            requiredItems: (offer.required_items || []).map(r => ({
              typeID: r.type_id,
              quantity: r.quantity,
            })),
          });
          totalOffers++;
        }
      }
    } catch (e) {
      // Some corps don't have LP stores, that's fine
    }

    if (i % 50 === 0 && i > 0) {
      console.log(`  ${i}/${corpIds.length} corps checked, ${totalOffers} offers from ${corpsWithOffers} corps`);
    }
    await sleep(100); // ~10 req/s
  }

  const payload = {
    saved_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    corp_names: corpNames,
    offers_by_type: offersByType,
  };

  writeJson('lp_offers_cache.json', payload);
  console.log(`  ${totalOffers} offers from ${corpsWithOffers} corps in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════
const BUILD_MAP = {
  systems:  { fn: buildSystems,     esi: false },
  missions: { fn: buildMissions,    esi: false },
  types:    { fn: buildTypesNames,  esi: false },
  agents:   { fn: buildAgentMeta,   esi: false },
  sde:      { fn: buildSdeData,     esi: false },
  hubs:     { fn: buildMissionHubs, esi: false },
  stations: { fn: buildStationNames, esi: true },
  lp:       { fn: buildLpOffers,    esi: true },
};

async function main() {
  const t0 = Date.now();
  console.log('═══ Missioneers\' Atlas — Data Build Pipeline ═══');
  console.log(`  SDE:  ${SDE_DIR}`);
  console.log(`  Out:  ${OUT_DIR}`);
  console.log(`  ESI:  ${DO_ESI ? 'yes' : 'no'}`);
  console.log(`  Only: ${ONLY || 'all'}`);
  console.log('');

  // Validate SDE dir
  try {
    const st = statSync(SDE_DIR);
    if (!st.isDirectory()) throw new Error('Not a directory');
  } catch {
    console.error(`Error: SDE directory not found: ${SDE_DIR}`);
    process.exit(1);
  }

  if (ONLY) {
    const target = BUILD_MAP[ONLY];
    if (!target) {
      console.error(`Unknown build target: ${ONLY}`);
      console.error(`Available: ${Object.keys(BUILD_MAP).join(', ')}`);
      process.exit(1);
    }
    if (target.esi && !DO_ESI) {
      console.error(`Target "${ONLY}" requires --esi flag`);
      process.exit(1);
    }
    await target.fn();
  } else {
    // Build all SDE-based targets
    for (const [name, { fn, esi }] of Object.entries(BUILD_MAP)) {
      if (esi && !DO_ESI) {
        console.log(`\n[${name}] Skipped (needs --esi flag)`);
        continue;
      }
      await fn();
    }
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n═══ Done in ${totalSec}s ═══`);
}

main().catch(e => {
  console.error('Build failed:', e);
  process.exit(1);
});
