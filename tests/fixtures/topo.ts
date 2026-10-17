import type { Topology } from 'topojson-specification';

/** 兩個方形縣市／鄉鎮（[0,0]-[1,1] 與 [2,0]-[3,1]），村里另含一個 type: null 的小島。 */
export const BASE_TOPO = {
  type: 'Topology',
  arcs: [
    [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
    [[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]],
  ],
  objects: {
    counties: { type: 'GeometryCollection', geometries: [
      { type: 'Polygon', arcs: [[0]], properties: { COUNTYCODE: '63000', COUNTYNAME: '臺北市' } },
      { type: 'Polygon', arcs: [[1]], properties: { COUNTYCODE: '68000', COUNTYNAME: '桃園市' } },
    ] },
    towns: { type: 'GeometryCollection', geometries: [
      { type: 'Polygon', arcs: [[0]], properties: { COUNTYCODE: '63000', COUNTYNAME: '臺北市', TOWNCODE: '63000010', TOWNNAME: '松山區' } },
      { type: 'Polygon', arcs: [[1]], properties: { COUNTYCODE: '68000', COUNTYNAME: '桃園市', TOWNCODE: '68000010', TOWNNAME: '桃園區' } },
    ] },
  },
} as unknown as Topology;

export const VILL_TOPO = {
  type: 'Topology',
  arcs: BASE_TOPO.arcs,
  objects: {
    villages: { type: 'GeometryCollection', geometries: [
      { type: 'Polygon', arcs: [[0]], properties: { COUNTYCODE: '63000', COUNTYNAME: '臺北市', TOWNCODE: '63000010', TOWNNAME: '松山區', VILLCODE: '63000010001', VILLNAME: '莊敬里' } },
      { type: 'Polygon', arcs: [[1]], properties: { COUNTYCODE: '68000', COUNTYNAME: '桃園市', TOWNCODE: '68000010', TOWNNAME: '桃園區', VILLCODE: '68000010001', VILLNAME: '中山里' } },
      { type: null, properties: { COUNTYCODE: '63000', COUNTYNAME: '臺北市', TOWNCODE: '63000010', TOWNNAME: '松山區', VILLCODE: '63000010S01', VILLNAME: '' } },
    ] },
  },
} as unknown as Topology;
