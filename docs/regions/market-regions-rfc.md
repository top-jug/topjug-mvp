# Market region RFC

## Status

Deferred. Physical administrative-region search ships first. Product review and a separate implementation issue are required before this model is added.

## Domain boundary

`regions` and `gyms.region_code` remain authoritative for a gym's real physical address. A gym has one physical second-level region. Branch names, station names, and perceived neighborhoods must never overwrite that value.

Market regions represent user-recognized search areas such as 홍대, 신촌, 성수, 판교, 일산, and 강남권. They overlap, may cross administrative boundaries, and are editorial search metadata rather than addresses.

## Proposed model

```text
market_regions(code PK, name, parent_code FK nullable, sort_order, search_aliases[], status)
gym_market_regions(gym_id FK, market_region_code FK, is_primary, rank, reviewed_by, reviewed_at)
PK (gym_id, market_region_code)
```

A gym may have multiple market-region assignments, while at most one assignment is primary. `rank` provides deterministic ordering within a market. Aliases help query interpretation but do not create implicit assignments.

## API and ranking

- Keep `physicalRegionCode` (currently exposed as `regionCode`) separate from a future `marketRegionCode`; do not overload one parameter.
- Apply explicit physical and market filters with `AND` when both are supplied.
- Rank exact market names first, then primary assignments, explicit aliases, assignment rank, and finally the existing stable gym-name order.
- Free-text `q` remains independent. Alias matches may improve ranking but must not bypass explicit filters.

## Governance

Product owns taxonomy and overlap policy. An administrator proposes assignments and aliases; a designated reviewer records approval before publication. Admin UI must show the physical address region beside market assignments and warn that changing one does not change the other.

Before implementation, product must review initial taxonomy, cross-boundary behavior, aliases, primary-assignment rules, ranking weights, and assignment ownership. The approved RFC should then become a separate schema/API/admin implementation issue.
