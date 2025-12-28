import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config'; // 이 import가 있는지 확인
import { LottoModule } from '../lotto/lotto.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // 명시적으로 파일 경로 지정 (생략 가능하나 안전함)
    }),
    LottoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
