// 縣市英文名（新圖資沒有 COUNTYENG 欄位）
const EN: Record<string, string> = {
  臺北市: 'Taipei City', 新北市: 'New Taipei City', 桃園市: 'Taoyuan City', 桃園縣: 'Taoyuan County',
  臺中市: 'Taichung City', 臺南市: 'Tainan City', 高雄市: 'Kaohsiung City', 基隆市: 'Keelung City',
  新竹市: 'Hsinchu City', 新竹縣: 'Hsinchu County', 苗栗縣: 'Miaoli County', 彰化縣: 'Changhua County',
  南投縣: 'Nantou County', 雲林縣: 'Yunlin County', 嘉義縣: 'Chiayi County', 嘉義市: 'Chiayi City',
  屏東縣: 'Pingtung County', 宜蘭縣: 'Yilan County', 花蓮縣: 'Hualien County', 臺東縣: 'Taitung County',
  澎湖縣: 'Penghu County', 金門縣: 'Kinmen County', 連江縣: 'Lienchiang County',
};

export function countyEn(name: string): string {
  return EN[name] ?? '';
}

/** 縣市排序（依原型） */
export const COUNTY_ORDER = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '嘉義市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'];
