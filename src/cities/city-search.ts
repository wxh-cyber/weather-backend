import { CITY_ALIAS_GROUPS } from './city-alias';

const ADMINISTRATIVE_SUFFIX_REGEX =
  /(特别行政区|自治州|自治县|自治区|市辖区|新区|开发区|街道办事处|街道|城区|地区|盟|州|区|县|旗|镇|乡|市)$/u;

const SEARCH_ALIAS_SEPARATOR = '|';

export type SearchableCityLike = {
  cityName: string;
  normalizedName?: string | null;
  searchAliases?: string | null;
};

export const normalizeCityName = (cityName: string) =>
  cityName
    .trim()
    .replace(/\s+/g, '')
    .replace(/\u3000/g, '');

export const stripAdministrativeSuffix = (cityName: string) =>
  normalizeCityName(cityName).replace(ADMINISTRATIVE_SUFFIX_REGEX, '');

const buildNormalizedVariants = (
  cityName: string,
  includeCitySuffix = true,
) => {
  const normalizedName = normalizeCityName(cityName);
  const strippedName = stripAdministrativeSuffix(normalizedName);
  const variants = [normalizedName];

  if (strippedName && strippedName !== normalizedName) {
    variants.push(strippedName);
  }

  if (includeCitySuffix && strippedName && !strippedName.endsWith('市')) {
    variants.push(`${strippedName}市`);
  }

  return [...new Set(variants.filter((value) => value.length > 0))];
};

const findAliasGroup = (cityName: string) => {
  const normalizedInput = normalizeCityName(cityName);
  const strippedInput = stripAdministrativeSuffix(normalizedInput);

  return CITY_ALIAS_GROUPS.find((group) => {
    const canonicalVariants = buildNormalizedVariants(group.canonicalName);
    if (
      canonicalVariants.includes(normalizedInput) ||
      canonicalVariants.includes(strippedInput)
    ) {
      return true;
    }

    return group.aliases.some((alias) => {
      const aliasVariants = buildNormalizedVariants(alias);
      return (
        aliasVariants.includes(normalizedInput) ||
        aliasVariants.includes(strippedInput)
      );
    });
  });
};

export const findAliasCanonicalName = (cityName: string) =>
  findAliasGroup(cityName)?.canonicalName;

export const buildSearchKeywordCandidates = (keyword: string) => {
  const variants = new Set(buildNormalizedVariants(keyword));
  const aliasGroup = findAliasGroup(keyword);

  if (aliasGroup) {
    buildNormalizedVariants(aliasGroup.canonicalName).forEach((value) =>
      variants.add(value),
    );

    aliasGroup.aliases.forEach((alias) => {
      buildNormalizedVariants(alias, false).forEach((value) =>
        variants.add(value),
      );
    });
  }

  return [...variants];
};

export const buildCitySearchMetadata = (cityName: string) => {
  const normalizedDisplayName = normalizeCityName(cityName);
  const normalizedName = stripAdministrativeSuffix(normalizedDisplayName);
  const searchKeys = new Set(
    buildNormalizedVariants(normalizedDisplayName, false),
  );
  const aliasGroup = findAliasGroup(cityName);

  if (aliasGroup) {
    buildNormalizedVariants(aliasGroup.canonicalName, false).forEach((value) =>
      searchKeys.add(value),
    );

    aliasGroup.aliases.forEach((alias) => {
      buildNormalizedVariants(alias, false).forEach((value) =>
        searchKeys.add(value),
      );
    });
  }

  return {
    normalizedName,
    searchAliases: [...searchKeys].join(SEARCH_ALIAS_SEPARATOR),
    searchKeys: [...searchKeys],
  };
};

export const getCitySearchKeys = (city: SearchableCityLike) => {
  const storedSearchKeys =
    city.searchAliases
      ?.split(SEARCH_ALIAS_SEPARATOR)
      .map((value) => normalizeCityName(value))
      .filter((value) => value.length > 0) ?? [];

  if (storedSearchKeys.length > 0) {
    return [...new Set(storedSearchKeys)];
  }

  return buildCitySearchMetadata(city.cityName).searchKeys;
};

export const getCityNormalizedName = (city: SearchableCityLike) =>
  normalizeCityName(
    city.normalizedName || stripAdministrativeSuffix(city.cityName),
  );

export const getCityMatchScore = (
  city: SearchableCityLike,
  keyword: string,
): number => {
  const candidates = buildSearchKeywordCandidates(keyword);
  const normalizedName = getCityNormalizedName(city);
  const displayName = normalizeCityName(city.cityName);
  const searchKeys = getCitySearchKeys(city);

  if (
    candidates.some(
      (candidate) => candidate === normalizedName || candidate === displayName,
    )
  ) {
    return 0;
  }

  if (candidates.some((candidate) => searchKeys.includes(candidate))) {
    return 1;
  }

  if (
    candidates.some((candidate) =>
      searchKeys.some(
        (key) => key.includes(candidate) || candidate.includes(key),
      ),
    )
  ) {
    return 2;
  }

  return Number.POSITIVE_INFINITY;
};
