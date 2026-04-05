import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CitiesModule } from './cities/cities.module';

@Module({
  imports: [AuthModule, CitiesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
