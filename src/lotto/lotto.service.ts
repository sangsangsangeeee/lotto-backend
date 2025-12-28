import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LottoCrawlerService } from './lotto.crawler.service';
export interface LottoCombination {
  numbers: number[];
  theme: string;
}

export interface LottoResponse {
  report: string;
  combinations: LottoCombination[];
}

@Injectable()
export class LottoService {
  private genAI: GoogleGenerativeAI;

  private model: GenerativeModel;

  constructor(
    private configService: ConfigService,
    private lottoCrawlerService: LottoCrawlerService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';

    this.genAI = new GoogleGenerativeAI(apiKey);

    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });
  }

  async generateLottoNumbers(): Promise<LottoResponse> {
    try {
      // 1. [변경] 크롤러 서비스에서 최신 통계 가져오기 (최근 20회차 분석)
      // 3년치(150회)를 실시간으로 다 가져오면 느리므로, 최근 흐름인 20회 정도가 적당합니다.
      const realTimeStats = await this.lottoCrawlerService.fetchRecentData(20);

      // 2. 프롬프트에 실시간 데이터 주입
      const prompt = `
        너는 로또 분석 전문가야. 아래의 **실시간 최신 통계 데이터**를 바탕으로 이번 주 당첨 예상 번호를 분석해줘.
        
        [데이터]
        ${realTimeStats}

        [요청사항]
        1. 6개의 숫자로 이루어진 로또 번호 조합 2세트 추천.
        2. 각 세트는 'theme' 부여.
        3. 'report' 필드에 분석 내용 요약.
        4. JSON 포맷 필수.

        {
          "report": "...",
          "combinations": [
            { "numbers": [], "theme": "" }
          ]
        }
      `;

      // ... (이후 코드는 동일)
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let text = response.text();
      text = text.replace(/```json|```/g, '').trim();

      return JSON.parse(text) as LottoResponse;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new InternalServerErrorException('AI 분석 중 오류가 발생했습니다.');
    }
  }
}
