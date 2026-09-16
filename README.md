# EVE Missioneers' Atlas v6.0

A comprehensive PvE mission planning tool for EVE Online, featuring:

- 🔍 **Agent Finder** — Find NPC agents by faction, corporation, level and location
- 🏪 **Nearest LP Store** — Locate the closest Loyalty Point store with faction-corp cascade filtering
- 🗺 **Mission Hub Discovery** — Top 200 most agent-dense systems in New Eden
- 📋 **Mission Query** — Browse 2,892 missions with full dialogue text in Chinese & English
- 🎖 **LP Store Finder** — Search which NPC corp LP stores sell a specific item

## Live Site

👉 **[Open Missioneers' Atlas](https://ycsqwan.github.io/missioneers-atlas/)**

## Tech Stack

- Pure vanilla HTML/CSS/JS — zero dependencies
- EVE SDE (Static Data Export) for static data
- EVE ESI API for real-time kill/jump data
- ~32 MB total static data (gzip ~8 MB)

## Data Sources

| File | Content | Size |
|------|---------|------|
| `sde_data.json` | Agents, stations, corps, factions | 2.8 MB |
| `systems_static.json` | System coordinates, security, stations | 5.7 MB |
| `types_names.json` | Item type names (Chinese & English) | 3.6 MB |
| `station_names.json` | 5,210 NPC station real names from ESI | 316 KB |
| `missions_data.json` | 2,892 missions with full dialogue text | 9.7 MB |
| `lp_offers_cache.json` | LP store offers cache | 7.0 MB |
| `mission_hubs.json` | Top 200 mission-dense systems | 16 KB |
| `agent_types.json` | Agent type definitions | 284 B |
| `agent_divisions.json` | Agent division definitions | 698 B |

## License

EVE Online and the EVE logo are trademarks of CCP hf.
This project is a third-party tool and is not affiliated with CCP Games.
