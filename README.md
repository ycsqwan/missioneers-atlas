# The New Eden Missioneers' Atlas

A comprehensive PvE mission planning and route analysis tool for EVE Online — pure static web app, zero dependencies.

**[https://missionatlas.site/](https://missionatlas.site/)**

---

## Features

### Route Planning
- **Full Scan** — Explore all systems within N jumps of origin, with ESI jump/activity data
- **Quick Scan** — Lightweight scan without ESI enrichment
- **Route Scan** — Analyze the topology between two systems (origin → destination)
- **Overview** — Full New Eden summary report

### Intelligence Tools
- **Agent Finder** — Search 4,400+ NPC agents with multi-dimensional filters:
  - Region / Constellation (cascade)
  - Division / Faction / Corporation (cascade)
  - Agent Level (1–5) / Type (Basic, Epic Arc, Faction Warfare, etc.)
  - Max Jumps from origin, Security range, Exclude Locators
- **Nearest LP Store** — Find the closest Loyalty Point store from any system, with Faction→Corporation cascade filtering
- **Mission Hub Discovery** — Top 200 most agent-dense systems in New Eden, ranked and filterable by Region, Constellation, Min Level, Agent Type, Division, Faction, Corporation
- **Mission Query** — Browse 2,892 missions with full dialogue text in Chinese & English, searchable by name (supports both languages)
- **LP Store Finder** — Reverse lookup: enter an item name → find which NPC corporation LP stores sell it, showing LP cost, ISK cost, and required items

### Star Map
- Canvas-based interactive starmap of all 8,000+ systems
- Region convex hulls with labels, stargate connection lines
- Minimap for quick navigation
- Click any system for detail panel: agents, stations, stargates, zKillboard 48h kill statistics
- Region filter, display toggles (hulls / labels / stargates / system names)

### General
- **Bilingual** — English / Chinese (中文) toggle
- **Dark / Light theme** — one-click switch
- **Global search** — autocomplete across all system name inputs
- **Offline support** — Service Worker caches all static data (~32 MB, ~8 MB gzip)
- **Responsive** — adapts to smaller screens

---

## Tech Stack

- Pure vanilla HTML / CSS / JS — zero dependencies, single `index.html`
- EVE SDE (Static Data Export) for static data
- EVE ESI API for real-time jump / activity data
- zKillboard API for kill statistics

---

## Data Files

| File | Content | Size |
|------|---------|------|
| `sde_data.json` | Agents, stations, corps, factions | 2.8 MB |
| `systems_static.json` | System coordinates, security, stargates, stations | 5.7 MB |
| `types_names.json` | Item type names (Chinese & English) | 3.6 MB |
| `station_names.json` | 5,210 NPC station real names from ESI | 316 KB |
| `missions_data.json` | 2,892 missions with full dialogue text | 9.7 MB |
| `lp_offers_cache.json` | LP store offers cache | 7.0 MB |
| `mission_hubs.json` | Top 200 mission-dense systems | 16 KB |
| `agent_types.json` | Agent type definitions | 284 B |
| `agent_divisions.json` | Agent division definitions | 698 B |

---

## License

EVE Online and the EVE logo are trademarks of CCP hf.
This project is a third-party tool and is not affiliated with CCP Games.
