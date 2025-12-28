import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface LottoResponse {
  report: string;
  combinations: number[][];
}

@Injectable()
export class LottoService {
  private genAI: GoogleGenerativeAI;

  private model: GenerativeModel;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';

    this.genAI = new GoogleGenerativeAI(apiKey);

    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });
  }

  async generateLottoNumbers(): Promise<LottoResponse> {
    try {
      const recentStats = `
        최근 3년 데이터 요약:
        - 최다 출현: 33, 12, 14, 35
        - 최근 10주 미출현: 5, 21, 29
        - 번호대별 흐름: 30번대 강세, 1~10번대 약세
      `;

      const prompt = `
        너는 로또 분석 전문가야. 아래의 최근 통계 데이터를 바탕으로 이번 주 당첨 예상 번호를 분석해줘.
        
        [데이터]
        ${recentStats}

        [요청사항]
        1. 6개의 숫자로 이루어진 로또 번호 조합 2세트를 추천해줘.
        2. 각 세트는 '균형 잡힌 조합', '미출현 번호 위주' 등 테마를 가져야 해.
        3. 이 조합을 추천한 이유(분석 리포트)를 2문장으로 요약해줘.
        4. 반드시 아래의 **JSON 포맷**으로만 응답해줘. 마크다운이나 다른 말은 쓰지 마.

        {
          "report": "여기에 분석 리포트 내용을 적어줘",
          "combinations": [
            [1, 2, 3, 4, 5, 6],
            [7, 8, 9, 10, 11, 12]
          ]
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      text = text.replace(/```json|```/g, '').trim();

      const parsedData: LottoResponse = JSON.parse(text) as LottoResponse;

      return parsedData;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new InternalServerErrorException('AI 분석 중 오류가 발생했습니다.');
    }
  }
}
