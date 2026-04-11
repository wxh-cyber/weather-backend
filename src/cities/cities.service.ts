import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Mock from 'mockjs';

export interface CityWeatherItem {
  cityName: string;
  weatherText: string;
  temperature: string;
}

@Injectable()
export class CitiesService {
  private allCities: CityWeatherItem[];

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

  createCity(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    if (this.findCityIndex(normalizedName) >= 0) {
      throw new ConflictException('城市已存在，请勿重复添加');
    }

    this.allCities.push(this.buildCityItem(normalizedName));
    return {
      code: 0,
      message: '新增成功',
      data: this.allCities.map((item) => ({ ...item })),
    };
  }

  renameCity(oldCityName: string, newCityName: string) {
    const normalizedOldName = this.normalizeAndValidateCityName(oldCityName);
    const normalizedNewName = this.normalizeAndValidateCityName(newCityName);
    const sourceIndex = this.findCityIndex(normalizedOldName);

    if (sourceIndex < 0) {
      throw new NotFoundException('未找到待修改的城市');
    }

    const targetIndex = this.findCityIndex(normalizedNewName);
    if (targetIndex >= 0 && targetIndex !== sourceIndex) {
      throw new ConflictException('目标城市名称已存在');
    }

    this.allCities[sourceIndex] = {
      ...this.allCities[sourceIndex],
      cityName: normalizedNewName,
    };

    return {
      code: 0,
      message: '修改成功',
      data: this.allCities.map((item) => ({ ...item })),
    };
  }

  deleteCity(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    const index = this.findCityIndex(normalizedName);
    if (index < 0) {
      throw new NotFoundException('未找到待删除的城市');
    }

    this.allCities.splice(index, 1);
    return {
      code: 0,
      message: '删除成功',
      data: this.allCities.map((item) => ({ ...item })),
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
    return cityNames.map((cityName) =>
      this.buildCityItem(cityName, weatherPool),
    );
  }

  private normalizeKeyword(keyword?: string) {
    return (keyword ?? '').trim().toLocaleLowerCase();
  }

  private normalizeAndValidateCityName(cityName: string) {
    const normalizedName = cityName.trim();
    if (!normalizedName) {
      throw new BadRequestException('城市名称不能为空');
    }
    return normalizedName;
  }

  private findCityIndex(cityName: string) {
    const normalizedKeyword = this.normalizeKeyword(cityName);
    return this.allCities.findIndex(
      (item) => this.normalizeKeyword(item.cityName) === normalizedKeyword,
    );
  }

  private buildCityItem(
    cityName: string,
    weatherPool?: string[],
  ): CityWeatherItem {
    const Random = Mock.Random;
    const weatherOptions = weatherPool ?? [
      '晴',
      '多云',
      '阴',
      '小雨',
      '中雨',
      '雷阵雨',
      '小雪',
    ];
    const weatherText = Random.pick(weatherOptions);
    const degree = Random.integer(-5, 38);
    return {
      cityName,
      weatherText,
      temperature: `${degree}°C`,
    };
  }
}
