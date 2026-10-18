// 把專案根目錄的 data/json/ 與 data/geo/ 複製到 web/public/data/。
// 由 npm 的 predev／prebuild 執行；缺檔時報錯結束，並說明要先執行哪個指令。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = ['county', 'town', 'village'];
const GEO_FILES = ['base', 'villages'];
const BUILD_DB = 'python -X utf8 tools/build_db.py';
const BUILD_GEO = 'node tools/geo/build_geo.mjs';

/** 轉檔中途留下的暫存與備份（例如 data/geo/.tmp-2014）不複製。 */
function isScratch(name) {
  return name.startsWith('.tmp-') || name.startsWith('.old-');
}

function requireFile(file, hint) {
  if (!fs.existsSync(file)) throw new Error(`找不到 ${file}，請先在專案根目錄執行 ${hint}`);
}

/**
 * 回傳 'copied'；上層沒有 data/（只有 web/ 的 GitHub repo，例如 Cloudflare 建置）時
 * 沿用已 commit 的 public/data，回傳 'kept'。
 */
export async function syncData({ repoRoot, dest }) {
  if (!fs.existsSync(path.join(repoRoot, 'data')) && fs.existsSync(path.join(dest, 'json', 'meta.json'))) return 'kept';
  const jsonDir = path.join(repoRoot, 'data', 'json');
  const geoDir = path.join(repoRoot, 'data', 'geo');
  const metaFile = path.join(jsonDir, 'meta.json');
  requireFile(metaFile, BUILD_DB);
  const { elections } = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  for (const e of elections) {
    if (e.has_results) {
      for (const lv of LEVELS) requireFile(path.join(jsonDir, String(e.year), `${lv}.json`), BUILD_DB);
    }
    for (const f of GEO_FILES) requireFile(path.join(geoDir, String(e.year), `${f}.json`), BUILD_GEO);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  const filter = (src) => !isScratch(path.basename(src));
  fs.cpSync(jsonDir, path.join(dest, 'json'), { recursive: true, filter });
  fs.cpSync(geoDir, path.join(dest, 'geo'), { recursive: true, filter });
  return 'copied';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  syncData({ repoRoot: path.resolve(web, '..'), dest: path.join(web, 'public', 'data') })
    .then((r) => console.log(r === 'kept' ? '找不到上層 data/，沿用 public/data/ 現有資料' : '資料已同步到 web/public/data/'))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
