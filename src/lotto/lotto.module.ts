import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LottoService } from './lotto.service';
import { LottoController } from './lotto.controller';

@Module({
  imports: [ConfigModule], // .env 사용을 위해 필요
  controllers: [LottoController],
  providers: [LottoService],
})
export class LottoModule {}
