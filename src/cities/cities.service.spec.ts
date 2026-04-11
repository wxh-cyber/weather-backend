import { CitiesService } from './cities.service';

describe('CitiesService', () => {
  let service: CitiesService;

  beforeEach(() => {
    service = new CitiesService();
  });

  it('should return all 34 cities when keyword is empty', () => {
    const result = service.getCities();

    expect(result.code).toBe(0);
    expect(result.message).toBe('获取成功');
    expect(result.data).toHaveLength(34);
  });

  it('should return matched cities when keyword hits', () => {
    const result = service.getCities('武汉');

    expect(result.code).toBe(0);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.some((item) => item.cityName.includes('武汉'))).toBe(
      true,
    );
    const first = result.data[0];
    expect(first).toBeDefined();
    expect(typeof first.cityName).toBe('string');
    expect(typeof first.weatherText).toBe('string');
    expect(first.temperature).toMatch(/^-?\d+°C$/);
  });

  it('should return empty array when keyword does not hit', () => {
    const result = service.getCities('不存在的城市关键字');

    expect(result.code).toBe(0);
    expect(result.message).toBe('获取成功');
    expect(result.data).toEqual([]);
  });

  it('should create a city when city name is unique', () => {
    const result = service.createCity('测试城');

    expect(result.code).toBe(0);
    expect(result.message).toBe('新增成功');
    expect(result.data.some((item) => item.cityName === '测试城')).toBe(true);
    expect(result.data).toHaveLength(35);
  });

  it('should throw conflict when creating duplicated city', () => {
    expect(() => service.createCity('北京市')).toThrow('城市已存在');
  });

  it('should rename a city when target name is not duplicated', () => {
    const result = service.renameCity('北京市', '北京城区');

    expect(result.code).toBe(0);
    expect(result.message).toBe('修改成功');
    expect(result.data.some((item) => item.cityName === '北京城区')).toBe(true);
    expect(result.data.some((item) => item.cityName === '北京市')).toBe(false);
  });

  it('should throw conflict when renaming city to an existing name', () => {
    expect(() => service.renameCity('北京市', '上海市')).toThrow(
      '目标城市名称已存在',
    );
  });

  it('should delete city when city exists', () => {
    const result = service.deleteCity('北京市');

    expect(result.code).toBe(0);
    expect(result.message).toBe('删除成功');
    expect(result.data.some((item) => item.cityName === '北京市')).toBe(false);
    expect(result.data).toHaveLength(33);
  });

  it('should throw not found when deleting missing city', () => {
    expect(() => service.deleteCity('不存在的城市')).toThrow(
      '未找到待删除的城市',
    );
  });
});
