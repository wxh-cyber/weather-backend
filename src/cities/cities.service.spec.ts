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
    expect(result.data.some((item) => item.cityName.includes('武汉'))).toBe(true);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        cityName: expect.any(String),
        weatherText: expect.any(String),
        temperature: expect.stringMatching(/^-?\d+°C$/),
      }),
    );
  });

  it('should return empty array when keyword does not hit', () => {
    const result = service.getCities('不存在的城市关键字');

    expect(result.code).toBe(0);
    expect(result.message).toBe('获取成功');
    expect(result.data).toEqual([]);
  });
});
