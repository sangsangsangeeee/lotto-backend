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

      const result = await this.model.generateContent(prompt);
      const response = result.response;

      // 1. 전체 텍스트 가져오기
      let text = response.text();

      console.log('Raw Gemini Output:', text); // 디버깅용

      // 2. [핵심 수정] JSON 부분만 추출하기 (Regex 또는 인덱스 활용)
      // 첫 번째 '{' 부터 마지막 '}' 까지 자릅니다.
      const jsonStartIndex = text.indexOf('{');
      const jsonEndIndex = text.lastIndexOf('}') + 1;

      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        text = text.substring(jsonStartIndex, jsonEndIndex);
      } else {
        // JSON 형태를 찾지 못했을 경우
        throw new InternalServerErrorException(
          'Gemini가 올바른 JSON을 반환하지 않았습니다.',
        );
      }

      // 3. 파싱
      const apiResult = JSON.parse(text) as {
        report: string;
        combinations: LottoCombination[];
      };

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
