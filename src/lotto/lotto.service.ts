import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LottoCrawlerService, LottoStats } from './lotto.crawler.service';
export interface LottoCombination {
  numbers: number[];
  theme: string;
}

export interface LottoResponse {
  report: string;
  combinations: LottoCombination[];
  stats: LottoStats;
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
      // 1. [핵심] 크롤러 서비스 한번 호출로 통계와 프롬프트 텍스트를 모두 확보
      const { stats, promptText } =
        await this.lottoCrawlerService.fetchAndAnalyze(30);

      const prompt = `
       너는 확률과 통계에 능통한 로또 분석 AI야. 아래의 **실시간 데이터 분석**을 바탕으로 가장 당첨 확률이 높은 번호를 조합해줘.
       
       ${promptText}

       [요청사항]
       1. 6개 번호 조합 2세트 추천.
       2. 전략:
          - 조합 A: '추세 추종' (Hot Numbers와 강세 구간 활용)
          - 조합 B: '평균 회귀' (Cold Numbers 포함, 총합 밸런스 조절)
       3. 각 세트마다 'theme' 필드에 전략 이름 명시.
       4. 'report'에는 이번 주차 분석 요약 (예: "이번 주는 30번대 과열이 예상되며...")
       5. JSON 응답 필수.

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

      const apiResult = JSON.parse(text) as LottoResponse;

      return {
        ...apiResult,
        stats,
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new InternalServerErrorException('AI 분석 중 오류가 발생했습니다.');
    }
  }
}
