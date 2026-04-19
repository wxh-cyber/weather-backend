export type CityAliasGroup = {
  canonicalName: string;
  aliases: string[];
};

export const CITY_ALIAS_GROUPS: CityAliasGroup[] = [
  {
    canonicalName: '东莞市',
    aliases: [
      '东莞',
      '东莞城区',
      '松山湖',
      '松山湖园区',
      '虎门',
      '虎门镇',
      '长安',
      '长安镇',
      '常平',
      '常平镇',
      '厚街',
      '厚街镇',
    ],
  },
];
