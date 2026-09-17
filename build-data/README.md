# Missioneers' Atlas — Data Build Pipeline

一键从 SDE + ESI 重建所有 JSON 数据文件。

## 快速使用

```bash
# 只构建 SDE 数据（不需要网络）
node build.mjs --sde G:/eve-online-static-data-3500372-jsonl

# 构建 SDE 数据 + 拉取 ESI 数据（station_names, lp_offers）
node build.mjs --sde G:/eve-online-static-data-3500372-jsonl --esi

# 只构建某个文件
node build.mjs --sde G:/eve-online-static-data-3500372-jsonl --only systems
```

## 构建目标

| 目标 | 数据源 | 输出文件 |
|------|--------|----------|
| `systems` | SDE | `systems_static.json` |
| `missions` | SDE | `missions_data.json` |
| `types` | SDE | `types_names.json` |
| `agents` | SDE | `agent_types.json` + `agent_divisions.json` |
| `sde` | SDE | `sde_data.json` |
| `hubs` | SDE | `mission_hubs.json` |
| `stations` | **ESI** | `station_names.json` |
| `lp` | **ESI** | `lp_offers_cache.json` |

## SDE 数据源

从 [Fuzzwork SDE](https://www.fuzzwork.co.uk/dump/) 下载 JSONL 格式的 SDE 数据。

需要的 JSONL 文件：
- `mapSolarSystems.jsonl` — 星系拓扑
- `mapConstellations.jsonl` — 星座
- `mapRegions.jsonl` — 区域
- `mapStargates.jsonl` — 星门连接
- `npcStations.jsonl` — NPC 空间站
- `npcCharacters.jsonl` — NPC 角色（含 agent 数据）
- `npcCorporations.jsonl` — NPC 军团
- `npcCorporationDivisions.jsonl` — 军团部门
- `factions.jsonl` — 势力
- `agentTypes.jsonl` — 代理人类型
- `types.jsonl` — 物品/类型名称
- `missions.jsonl` — 任务数据

## ESI 数据

需要 `--esi` 标志才会拉取：
- `station_names.json` — 调用 ESI `/universe/stations/{id}/` 获取每个 NPC 空间站名称
- `lp_offers_cache.json` — 调用 ESI `/loyalty/stores/{corp_id}/offers/` 获取所有 NPC 军团 LP 商店

## 更新 SDE 版本

1. 下载新版 SDE JSONL 数据到新目录
2. 运行 `node build.mjs --sde <新目录>`
3. 运行 `node build.mjs --sde <新目录> --esi`（可选，刷新 ESI 数据）
4. 提交并推送到 GitHub Pages
