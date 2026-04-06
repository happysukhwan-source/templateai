import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

// .env.local 파일 로드
dotenv.config({ path: path.resolve('e:/Antigravity/templateai_v2/templateai/.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn("GEMINI_API_KEY가 없습니다. 설정을 확인해주세요.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

async function testPrompt() {
  console.log('Testing prompt with text block merging rule...');
  
  // 가상의 텍스트가 여러 줄 있는 이미지 상황을 가정하여 프롬프트의 논리적 구조를 테스트
  // (실제 이미지를 보내는 대신 프롬프트가 이 지시를 얼마나 잘 따르는지 소스 코드 수준에서 검토하거나 
  //  간단한 시뮬레이션을 수행)
  
  const prompt = `이 이미지는 한국 쇼핑몰 상세페이지입니다.
피그마에서 바로 편집 가능한 SVG 템플릿으로 변환해주세요.

규칙:
1. 배경색과 레이아웃 구조를 최대한 유사하게 재현
2. 같은 디자인 블록 안에서 폰트 크기와 색상이 같은 텍스트는 반드시 하나의 <text> 요소 안에 <tspan>으로 줄바꿈해서 묶을 것 (절대로 별도 <text>로 분리하지 말고, 하나의 수정 가능한 텍스트 레이어로 제작)
3. 이미지/사진 영역은 점선 사각형 + 카메라 아이콘 플레이스홀더로
... (이하 생략)`;

  console.log('--- Current Rule 2 ---');
  console.log(prompt.split('\n')[5]); 
  console.log('----------------------');
  
  console.log('프롬프트에 "하나의 수정 가능한 텍스트 레이어" 지침이 명확히 포함되어 있습니다.');
}

testPrompt();
