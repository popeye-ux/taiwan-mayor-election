import type { Level } from './types';

// 檔案由 scripts/sync-data.mjs 複製到 public/data/
const root = () => `${import.meta.env.BASE_URL}data/`;

export const metaUrl = () => `${root()}json/meta.json`;
export const resultsUrl = (year: number, level: Level) => `${root()}json/${year}/${level}.json`;
export const baseGeoUrl = (year: number) => `${root()}geo/${year}/base.json`;
export const villagesGeoUrl = (year: number) => `${root()}geo/${year}/villages.json`;
