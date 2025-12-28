import { Controller, Get } from '@nestjs/common';
import { LottoService } from './lotto.service';

@Controller('lotto')
export class LottoController {
  constructor(private readonly lottoService: LottoService) {}

  @Get('analyze')
  async getAnalysis() {
    return await this.lottoService.generateLottoNumbers();
  }
}
