import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';

// 1. API에서 받아오는 Raw 데이터 타입 정의
interface LottoApiData {
  returnValue: string; // 'success' | 'fail'
  drwNo: number; // 회차
  drwNoDate: string; // 날짜
  drwtNo1: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo4: number;
  drwtNo5: number;
  drwtNo6: number;
  bnusNo: number;
}

// 2. 가공된 통계 데이터 타입 정의
export interface LottoStats {
  latestDrwNo: number; // 최신 회차
  hotNumbers: { number: number; count: number }[]; // 많이 나온 번호 Top 5
  coldNumbers: number[]; // 최근 10회 이상 안 나온 번호
  recentSums: number[]; // 최근 5회차 당첨번호 총합
  sectionMap: Record<string, number>; // 번호대별 분포 (1~10, 11~20...)
}

@Injectable()
export class LottoCrawlerService {
  private readonly logger = new Logger(LottoCrawlerService.name);
  private readonly BASE_URL =
    'https://www.dhlottery.co.kr/common.do?method=getLottoNumber';

  /**
   * 메인 함수: 최근 N회차 데이터를 가져와 고급 통계를 분석하여 반환
   * @param count 분석할 과거 회차 수 (기본값 30회)
   */
  async fetchAndAnalyze(
    count: number = 30,
  ): Promise<{ stats: LottoStats; promptText: string }> {
    // 1. 데이터 수집
    const rawDataList = await this.fetchRecentData(count);

    if (rawDataList.length === 0) {
      throw new Error('로또 데이터를 불러오지 못했습니다.');
    }

    // 2. 고급 통계 계산
    const stats = this.calculateAdvancedStats(rawDataList);

    // 3. AI 프롬프트용 텍스트 포맷팅
    const promptText = this.formatStatsForPrompt(stats);

    return { stats, promptText };
  }

  // ------------------------------------------------------------------
  // 내부 로직 메서드들
  // ------------------------------------------------------------------

  // 현재 회차 계산 (공식: 1회차 날짜 기준)
  private getCurrentDrwNo(): number {
    const baseDate = new Date('2002-12-07T20:00:00'); // 1회차
    const now = new Date();
    // 토요일 20:00 이후 ~ 20:45(추첨 전) 사이일 수 있으므로 약간의 보정 필요할 수 있으나, 단순 계산용
    const diffTime = now.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  // 데이터 병렬 Fetching
  private async fetchRecentData(count: number): Promise<LottoApiData[]> {
    const currentDrwNo = this.getCurrentDrwNo();
    // 아직 추첨 안 된 회차가 있을 수 있으므로 -1회차부터 시도하거나, 성공한 것만 필터링
    const requests: Promise<AxiosResponse<LottoApiData>>[] = [];

    for (let i = 0; i < count; i++) {
      const drwNo = currentDrwNo - i;
      // 최신회차부터 과거 순으로 요청
      requests.push(axios.get<LottoApiData>(`${this.BASE_URL}&drwNo=${drwNo}`));
    }

    try {
      const responses = await Promise.all(requests);

      // 'success'인 데이터만 걸러내고 포맷팅
      const validData = responses
        .map((res) => res.data)
        .filter((data) => data.returnValue === 'success');

      return validData;
    } catch (error) {
      this.logger.error('동행복권 API 호출 실패', error);
      return [];
    }
  }

  // 통계 계산 로직 (Hot, Cold, Sum, Section)
  private calculateAdvancedStats(history: LottoApiData[]): LottoStats {
    const frequency: Record<number, number> = {};
    const lastAppearance: Record<number, number> = {};
    const sectionCounts = {
      '1-10': 0,
      '11-20': 0,
      '21-30': 0,
      '31-40': 0,
      '41-45': 0,
    };
    const recentSums: number[] = [];

    const latestDrwNo = history[0].drwNo; // 가져온 데이터 중 가장 최신 회차

    // 데이터 순회 (history는 최신 -> 과거 순서라고 가정하지만, 혹시 모르니 정렬 가능)
    // 여기선 fetchRecentData 로직상 최신순으로 들어옴 (index 0이 최신)

    // 최근 5회차 총합 흐름용
    for (let i = 0; i < Math.min(5, history.length); i++) {
      const nums = [
        history[i].drwtNo1,
        history[i].drwtNo2,
        history[i].drwtNo3,
        history[i].drwtNo4,
        history[i].drwtNo5,
        history[i].drwtNo6,
      ];
      const sum = nums.reduce((a, b) => a + b, 0);
      recentSums.push(sum);
    }

    // 전체 데이터 분석 (빈도, 구간, 미출현)
    history.forEach((round) => {
      const nums = [
        round.drwtNo1,
        round.drwtNo2,
        round.drwtNo3,
        round.drwtNo4,
        round.drwtNo5,
        round.drwtNo6,
      ];

      nums.forEach((num) => {
        // 1. 빈도(Hot)
        frequency[num] = (frequency[num] || 0) + 1;

        // 2. 마지막 출현 회차 (처음 만나는게 가장 최신이므로 기록이 없을때만 할당)
        if (lastAppearance[num] === undefined) {
          lastAppearance[num] = round.drwNo;
        }

        // 3. 구간(Section) - 전체 기간 누적
        if (num <= 10) sectionCounts['1-10']++;
        else if (num <= 20) sectionCounts['11-20']++;
        else if (num <= 30) sectionCounts['21-30']++;
        else if (num <= 40) sectionCounts['31-40']++;
        else sectionCounts['41-45']++;
      });
    });

    // 결과 정제: Hot Numbers (Top 5)
    const hotNumbers = Object.entries(frequency)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([num, count]) => ({ number: parseInt(num), count }));

    // 결과 정제: Cold Numbers
    // 최근 10회차 이상 안 나온 번호 (현재회차 - 마지막출현회차 >= 10)
    // 만약 한 번도 안 나왔다면(lastAppearance[num] 없음), 매우 Cold한 것임.
    const coldNumbers: number[] = [];
    for (let i = 1; i <= 45; i++) {
      const lastDrw = lastAppearance[i];

      // 분석 기간(30주) 내에 아예 안 나왔거나, 나온지 10주 넘었으면 Cold
      if (lastDrw === undefined || latestDrwNo - lastDrw >= 10) {
        coldNumbers.push(i);
      }
    }

    return {
      latestDrwNo,
      hotNumbers,
      coldNumbers: coldNumbers.slice(0, 7), // 너무 많으면 7개까지만
      recentSums: recentSums.reverse(), // 시간순(과거->현재)로 보기 위해 뒤집음
      sectionMap: sectionCounts,
    };
  }

  // Gemini 프롬프트용 문자열 생성
  private formatStatsForPrompt(stats: LottoStats): string {
    const hotStr = stats.hotNumbers
      .map((h) => `${h.number}번(${h.count}회)`)
      .join(', ');
    const coldStr = stats.coldNumbers.join(', ');
    const sumStr = stats.recentSums.join(' -> ');
    const sectionStr = Object.entries(stats.sectionMap)
      .map(([key, val]) => `${key}구간:${val}회`)
      .join(', ');

    return `
      [실시간 로또 통계 데이터 (기준: 최근 30회차, 최신회차: ${stats.latestDrwNo}회)]
      1. 🔥 Hot Numbers (최다 출현): ${hotStr}
      2. ❄️ Cold Numbers (장기 미출현, 10주 이상): ${coldStr}
      3. 📈 당첨번호 총합 흐름 (최근 5회): ${sumStr} (참고: 보통 120~160 사이가 평균)
      4. 📊 구간별 분포: ${sectionStr}
    `;
  }
}
