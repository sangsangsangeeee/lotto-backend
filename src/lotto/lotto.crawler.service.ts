import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';

interface LottoData {
  totSellamnt: number;
  returnValue: string;
  drwNoDate: string;
  firstWinamnt: number;
  drwtNo6: number;
  drwtNo4: number;
  firstPrzwnerCo: number;
  drwtNo5: number;
  bnusNo: number;
  firstAccumamnt: number;
  drwNo: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo1: number;
}

interface LottoHistory {
  drwNo: number;
  date: string;
  numbers: number[];
  bonus: number;
}

@Injectable()
export class LottoCrawlerService {
  // 동행복권 공식(하지만 숨겨진) 무료 API 엔드포인트
  private readonly BASE_URL =
    'https://www.dhlottery.co.kr/common.do?method=getLottoNumber';

  // 1. 최신 회차 번호 계산 (매번 메인페이지를 긁는건 느리므로 날짜로 계산)
  private getCurrentDrwNo(): number {
    const baseDate = new Date('2002-12-07T20:00:00'); // 1회차 날짜
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - baseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  // 2. 최근 N회차 데이터 가져오기 (비동기 병렬 처리)
  async fetchRecentData(count: number = 10) {
    const currentDrwNo = this.getCurrentDrwNo();
    const requests = [] as Promise<AxiosResponse<LottoData>>[];

    // 최근 회차부터 과거로 count만큼 요청 생성
    // (아직 추첨 전인 토요일 저녁 등을 고려해 -1 회차부터 안전하게 조회하거나 에러 핸들링 필요)
    // 여기서는 간단하게 현재 회차부터 과거 10개를 조회
    for (let i = 0; i < count; i++) {
      const drwNo = currentDrwNo - i;
      requests.push(axios.get<LottoData>(`${this.BASE_URL}&drwNo=${drwNo}`));
    }

    try {
      const responses = await Promise.all(requests);

      console.info('responses ----->', responses);

      // 데이터 정제
      const lottoHistory: LottoHistory[] = responses
        .map((res) => res.data)
        .filter((data) => data.returnValue === 'success') // 실패(아직 추첨 안함) 제외
        .map((data) => ({
          drwNo: data.drwNo, // 회차
          date: data.drwNoDate, // 날짜
          numbers: [
            data.drwtNo1,
            data.drwtNo2,
            data.drwtNo3,
            data.drwtNo4,
            data.drwtNo5,
            data.drwtNo6,
          ].sort((a, b) => a - b),
          bonus: data.bnusNo,
        }));

      console.info('lottoHistory', lottoHistory);

      return this.analyzeHistory(lottoHistory);
    } catch (error) {
      console.error('Lotto Fetch Error:', error);
      return '데이터 조회 실패로 기본 통계 사용';
    }
  }

  // 3. 가져온 데이터로 간단한 통계 문구 생성 (AI에게 던져줄 용도)
  private analyzeHistory(history: LottoHistory[]) {
    const numberCounts: Record<number, number> = {};
    const missingNumbers = new Set(Array.from({ length: 45 }, (_, i) => i + 1));

    history.forEach((round) => {
      round.numbers.forEach((num) => {
        numberCounts[num] = (numberCounts[num] || 0) + 1;
        missingNumbers.delete(num);
      });
    });

    // 최다 출현 번호 Top 5
    const topNumbers = Object.entries(numberCounts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5)
      .map(([num]) => num)
      .join(', ');

    // 미출현 번호 (최근 N회차 동안 안 나온 번호)
    const coldNumbers = Array.from(missingNumbers).slice(0, 5).join(', ');

    return `
      [실시간 데이터 기반 통계]
      - 분석 대상: 최근 ${history.length}회차 (${history[history.length - 1].drwNo}회 ~ ${history[0].drwNo}회)
      - 최다 출현 번호: ${topNumbers}
      - 최근 미출현 번호: ${coldNumbers}
      - 최근 회차 당첨번호(${history[0].drwNo}회): ${history[0].numbers.join(', ')}
    `;
  }
}
