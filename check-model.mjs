// Node.js 18 이상에서는 fetch가 내장되어 있습니다.
// 만약 Node 버전이 낮아 fetch 에러가 난다면 'axios'를 사용하거나 node 버전을 확인해주세요.

const apiKey = 'AIzaSyAwepIZlFOd17SCj-ZBUuZ7azuxyI4vUI8'; // 여기에 API 키를 넣어주세요
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function checkAvailableModels() {
  console.log('🔍 사용 가능한 모델 목록을 조회 중입니다...');

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.models) {
      console.log('\n✅ [확인된 모델 목록]');
      // 'generateContent' 기능이 있는 모델만 필터링해서 보여줍니다.
      const availableModels = data.models
        .filter((model) =>
          model.supportedGenerationMethods.includes('generateContent'),
        )
        .map((model) => model.name.replace('models/', '')); // 'models/' 접두사 제거

      console.log(availableModels);

      console.log(
        '\n💡 [추천] 위 목록에 있는 이름 중 하나를 골라 코드에 넣으세요.',
      );
      console.log(
        "예: 'gemini-1.5-flash'가 없다면 'gemini-1.5-flash-001' 등을 찾아보세요.",
      );
    } else {
      console.log('모델 데이터를 찾을 수 없습니다:', data);
    }
  } catch (error) {
    console.error('❌ 모델 목록 조회 실패:', error.message);
  }
}

checkAvailableModels();
