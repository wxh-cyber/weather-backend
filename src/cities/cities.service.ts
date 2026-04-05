import { Injectable } from '@nestjs/common';
import Mock from 'mockjs';

export interface CityWeatherItem {
  cityName: string;
  weatherText: string;
  temperature: string;
}

@Injectable()
export class CitiesService {
  private readonly allCities: CityWeatherItem[];

  constructor() {
    this.allCities = this.buildMockCities();
  }

  getCities(keyword?: string) {
    const normalizedKeyword = this.normalizeKeyword(keyword);
    const data = normalizedKeyword
      ? this.allCities.filter((item) =>
          this.normalizeKeyword(item.cityName).includes(normalizedKeyword),
        )
      : this.allCities;

    return {
      code: 0,
      message: '获取成功',
      data: data.map((item) => ({ ...item })),
    };
  }

  private buildMockCities() {
    const weatherPool = ['晴', '多云', '阴', '小雨', '中雨', '雷阵雨', '小雪'];
    const cityNames = [
      '北京市',
      '天津市',
      '上海市',
      '重庆市',
      '石家庄市',
      '太原市',
      '呼和浩特市',
      '沈阳市',
      '长春市',
      '哈尔滨市',
      '南京市',
      '杭州市',
      '合肥市',
      '福州市',
      '南昌市',
      '济南市',
      '郑州市',
      '武汉市',
      '长沙市',
      '广州市',
      '南宁市',
      '海口市',
      '成都市',
      '贵阳市',
      '昆明市',
      '拉萨市',
      '西安市',
      '兰州市',
      '西宁市',
      '银川市',
      '乌鲁木齐市',
      '香港特别行政区',
      '澳门特别行政区',
      '台北市',
    ];
    const Random = Mock.Random;

    return cityNames.map((cityName) => {
      const weatherText = Random.pick(weatherPool);
      const degree = Random.integer(-5, 38);
      const temperature = `${degree}°C`;
      return {
        cityName,
        weatherText,
        temperature,
      };
    });
  }

  private normalizeKeyword(keyword?: string) {
    return (keyword ?? '').trim().toLocaleLowerCase();
  }
}
