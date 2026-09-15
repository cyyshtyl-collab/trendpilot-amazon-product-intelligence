export type CategoryGroup = {
  label: string;
  categories: readonly string[];
};

/** Amazon-oriented category catalog shared by entry and collection workflows. */
export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    label: '家居与生活',
    categories: [
      '家居用品',
      '厨房用品',
      '收纳整理',
      '清洁用品',
      '家具',
      '庭院园艺',
      '照明用品',
    ],
  },
  {
    label: '数码与办公',
    categories: [
      '消费电子',
      '手机配件',
      '电脑配件',
      '智能家居',
      '摄影器材',
      '办公用品',
    ],
  },
  {
    label: '户外与出行',
    categories: [
      '旅行配件',
      '汽车用品',
      '户外运动',
      '露营用品',
      '骑行用品',
      '运动健身',
    ],
  },
  {
    label: '宠物与家庭',
    categories: ['宠物用品', '母婴用品', '儿童用品', '玩具与游戏', '节庆用品'],
  },
  {
    label: '个护与时尚',
    categories: [
      '美容个护',
      '健康护理',
      '服装配饰',
      '鞋靴',
      '箱包',
      '珠宝饰品',
    ],
  },
  {
    label: '兴趣与专业',
    categories: [
      '工具家装',
      '工业用品',
      '艺术手工',
      '乐器',
      '图书文具',
      '食品饮料',
    ],
  },
] as const;

export const PRODUCT_CATEGORIES = CATEGORY_GROUPS.flatMap(
  (group) => group.categories,
);
