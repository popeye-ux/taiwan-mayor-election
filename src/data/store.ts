// 載入各屆結果與圖資，建索引，提供「基準代碼 → 本屆列／形狀」的查詢。
import type { FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';
import type { Level, Meta, ResultRow, VillProps } from './types';
import { MetaIndex } from './meta';
import { baseGeoUrl, metaUrl, resultsUrl, villagesGeoUrl } from './paths';
import { buildVillageIds, fromBaseArea, type VillageIds } from './crossYear';
import { toBaseGeo, toVillages, townOfVillage, type BaseGeo } from '../geo/topo';

/** 2026 代碼 | `${year}:${code}`（2026 沒有的村里）| `n:${name}`（沒有內政部代碼的村里） */
export type VillageId = string;

interface JsonCache { get<T>(url: string): Promise<T> }

interface YearRows { rows: ResultRow[]; byCode: Map<string, ResultRow> }

function indexRows(rows: ResultRow[]): YearRows {
  const byCode = new Map<string, ResultRow>();
  for (const r of rows) for (const c of r.moi) byCode.set(c, r);
  return { rows, byCode };
}

export class ElectionStore {
  meta!: MetaIndex;
  private base = new Map<number, BaseGeo>();
  private areaCodes = new Map<number, Set<string>>();
  private results = new Map<string, YearRows>();
  private villages = new Map<number, FeatureCollection<Geometry, VillProps>>();
  private villageIds = new Map<number, VillageIds>();
  private townsLoading: Promise<void> | null = null;
  private villagesLoading: Promise<void> | null = null;

  constructor(private cache: JsonCache) {}

  async init(): Promise<void> {
    this.meta = new MetaIndex(await this.cache.get<Meta>(metaUrl()));
    await Promise.all([
      ...this.meta.years().map(async (y) => {
        const g = toBaseGeo(await this.cache.get<Topology>(baseGeoUrl(y)));
        this.base.set(y, g);
        this.areaCodes.set(y, new Set([
          ...g.counties.features.map((f) => f.properties.COUNTYCODE),
          ...g.towns.features.map((f) => f.properties.TOWNCODE),
        ]));
      }),
      this.loadLevel('county'),
    ]);
  }

  ensureTowns(): Promise<void> {
    return (this.townsLoading ??= this.retryable(this.loadLevel('town'), () => { this.townsLoading = null; }));
  }

  ensureVillages(): Promise<void> {
    return (this.villagesLoading ??= this.retryable((async () => {
      await Promise.all([
        this.ensureTowns(),
        this.loadLevel('village'),
        ...this.meta.years().map(async (y) => {
          this.villages.set(y, toVillages(await this.cache.get<Topology>(villagesGeoUrl(y))));
        }),
      ]);
      const years = this.meta.years();
      const byYear = new Map(years.map((y) => [y, this.villages.get(y)!.features.map((f) => f.properties)]));
      this.villageIds = buildVillageIds(byYear, years);
    })(), () => { this.villagesLoading = null; }));
  }

  hasVillages(): boolean {
    return this.villageIds.size > 0;
  }

  baseGeo(year: number): BaseGeo {
    const g = this.base.get(year);
    if (!g) throw new Error(`尚未載入 ${year} 圖資`);
    return g;
  }

  /** 縣市、鄉鎮：基準代碼 → 本屆代碼 */
  areaCode(year: number, baseCode: string): string | null {
    return fromBaseArea(baseCode, this.areaCodes.get(year) ?? new Set());
  }

  villagesOfTown(year: number, baseTown: string): FeatureCollection<Geometry, VillProps> {
    const code = this.areaCode(year, baseTown);
    const all = this.villages.get(year)?.features ?? [];
    return { type: 'FeatureCollection', features: code ? all.filter((f) => f.properties.TOWNCODE === code) : [] };
  }

  rowByCode(year: number, level: Level, yearCode: string): ResultRow | undefined {
    return this.results.get(`${year}|${level}`)?.byCode.get(yearCode);
  }

  countyRow(year: number, baseCounty: string): ResultRow | undefined {
    const code = this.areaCode(year, baseCounty);
    return code ? this.rowByCode(year, 'county', code) : undefined;
  }

  townRow(year: number, baseTown: string): ResultRow | undefined {
    const code = this.areaCode(year, baseTown);
    return code ? this.rowByCode(year, 'town', code) : undefined;
  }

  villageRow(year: number, id: VillageId, baseTown: string): ResultRow | undefined {
    if (id.startsWith('n:')) {
      const name = id.slice(2);
      return this.villageRowsOfTown(year, baseTown).find((r) => r.moi.length === 0 && r.name === name);
    }
    const code = this.villageIds.get(year)?.fromId.get(id);
    return code ? this.rowByCode(year, 'village', code) : undefined;
  }

  /** 本屆代碼 → 村里 id；群組一律以群組內最小的代碼代表。 */
  villageIdOf(year: number, yearCode: string): VillageId {
    const r = this.rowByCode(year, 'village', yearCode);
    const code = r && r.group ? [...r.moi].sort()[0] : yearCode;
    return this.villageIds.get(year)?.toId.get(code) ?? `${year}:${code}`;
  }

  /** 本屆要加選取外框的代碼（群組全部） */
  villageCodesIn(year: number, id: VillageId, baseTown: string): string[] {
    const r = this.villageRow(year, id, baseTown);
    if (r) return [...r.moi];
    const ids = this.villageIds.get(year);
    const code = ids?.fromId.get(id);
    if (!code) return [];
    // 未開票的屆次沒有結果列：借用最近一屆的群組成員，換成本屆代碼
    if (!this.meta.hasResults(year)) {
      for (const y of [...this.meta.resultYears()].reverse()) {
        const g = this.villageRow(y, id, baseTown);
        if (!g) continue;
        const yIds = this.villageIds.get(y)!;
        const codes = g.moi.map((c) => ids!.fromId.get(yIds.toId.get(c) ?? '')).filter((c): c is string => !!c);
        return codes.length ? codes.sort() : [code];
      }
    }
    return [code];
  }

  countyRows(year: number): ResultRow[] {
    return this.results.get(`${year}|county`)?.rows ?? [];
  }

  townRowsOfCounty(year: number, baseCounty: string): ResultRow[] {
    const c = this.countyRow(year, baseCounty);
    if (!c) return [];
    return (this.results.get(`${year}|town`)?.rows ?? []).filter((r) => r.county === c.county);
  }

  /** 該鄉鎮本屆的村里列（含沒有內政部代碼者），依 id 排序 */
  villageRowsOfTown(year: number, baseTown: string): ResultRow[] {
    const t = this.townRow(year, baseTown);
    const code = this.areaCode(year, baseTown);
    const rows = this.results.get(`${year}|village`)?.rows ?? [];
    return rows
      .filter((r) => (r.moi.length
        ? code !== null && townOfVillage(r.moi[0]) === code
        : t !== undefined && r.county === t.county && r.town === t.town))
      .sort((a, b) => a.id - b.id);
  }

  private async loadLevel(level: Level): Promise<void> {
    await Promise.all(this.meta.resultYears().map(async (y) => {
      this.results.set(`${y}|${level}`, indexRows(await this.cache.get<ResultRow[]>(resultsUrl(y, level))));
    }));
  }

  /** 失敗時清掉記住的 Promise，下次呼叫會重新載入 */
  private retryable(p: Promise<void>, reset: () => void): Promise<void> {
    p.catch(reset);
    return p;
  }
}
