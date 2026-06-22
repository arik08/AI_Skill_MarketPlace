window.MOCK_FILE_CONTENTS = {
            "skill-01": {
                "readme": `# 📊 투자 타당성 검토 Skill 

이 스킬은 투자 검토보고서 작성을 간소화하고 최적의 사업성 지표 분석과 숨은 리스크를 종합 도출하는 AI 스킬입니다.

## 주요 기능
1. **투자 개요 자동 추출**: 투자명, 투자금액, 기대효과 등 텍스트 문맥 분석 후 요약
2. **NPV / IRR 정교화 체크**: 사내 ERP 기반 표준 회수계수를 가중 대조하여 최적 검토
3. **리스크 항목 도출**: 재무적, 법적, 환경적 측면에서 예상되는 투자 위험 조언

## 활용 가이드
- **적합한 상황**: 투자심의 위원회 제출용 기초 원안 검토, 신사업 타당성 기초 스터디
- **피해야 할 상황**: 정밀 세무 정산 대체, 공시기준 금융 수치 연산 직접 대체 (반드시 전문가 수치 대조 필요)

## 입력 예시
- **투자명**: 친환경 설비 고도화 구축
- **투자규모**: 500억 원
- **목표 효과**: 탄소배출 연 15만톤 감축 및 세제 혜택`,
                "use_cases": `### 💡 사용 시나리오

#### 시나리오 A: 사내 수시 보고용 초안 작성시
- 신규 제철 공정 에너지 혁신 장치 검토안 구상 중, 정량적 기여 이외의 정성적 타당성 설명이 부진할 때 본 스킬을 통해 비즈니스 모델 강점을 자동으로 부각합니다.

#### 시나리오 B: 핵심 한계점 역추적
- 투자자가 과하게 긍정적 측면만 보고할 경우, 시스템 검증 논리에 근거해 가상 투자 반박 핵심 시나리오(Risk Scenario)를 구성해 대응력을 보완합니다.`,
                "skill_yaml": `name: "investment-feasibility-analyzer"
version: "1.3.2"
category: "투자관리"
owner: "오명철"
team: "경영기획DX추진TF팀"
status: "Verified"
required_systems:
  - erp_investment_core
  - mcp_document_search
quality_score: 87`,
                "input_schema": `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "InvestmentFeasibilityInput",
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "검토 프로젝트의 공식명"
    },
    "budget": {
      "type": "number",
      "description": "총 투자 금액 (단위: 억 원)"
    },
    "paybackPeriod": {
      "type": "integer",
      "description": "예상되는 목표 회수 기간 (연 단위)"
    }
  },
  "required": ["projectName", "budget"]
}`,
                "system_prompt": `You are an expert financial investment analyst in steel industry context.
Based on the provided project parameters and constraints:
1. Estimate conservative Net Present Value (NPV) tendencies based on industry benchmark rates (typically 7%).
2. Detail exactly 3 critical business risks specific to steel/heavy manufacture context.
3. Keep the tone executive, precise, and professional. Avoid fuzzy assumptions.`,
                "npv_calculator": `import numpy as np

def calculate_npv_and_irr(cash_flows, discount_rate=0.07):
    """
    사내 투자평가 표준 공식 모듈
    """
    npv = np.npv(discount_rate, cash_flows)
    try:
        irr = np.irr(cash_flows)
    except Exception:
        irr = None
    return {
        "calculated_npv_billon": round(npv / 1e8, 2),
        "calculated_irr_percent": round(irr * 100, 2) if irr else "N/A"
    }`,
                "example_input": `{
  "projectName": "광양 제3용광로 스마트 모니터링 고도화",
  "budget": 240,
  "paybackPeriod": 5
}`,
                "example_output": `### [생성 결과 예시]

#### 1. 사업 타당성 정성 요약
- 스마트 센서 연계를 통한 용융 속도 자동 조율로, 원가 절감 연 48억 창출 가능. 연간 생산 지표 1.8% 상향 기대.

#### 2. NPV 경향적 시뮬레이션
- 연차별 유출입 반영 시 할인율 7% 기준 약 45억 순현가(NPV) 강세 예상.

#### 3. 3대 핵심 리스크
- 센서 오지연 보정 오류 시 공정 셧다운 리스크
- 초기 하드웨어 라이선스 비용 급상승 위험
- 내부 정비 보전 인원의 신규 소프트웨어 숙달 러닝커브 지체 가능성`,
                "test_cases": `[
  {
    "case_id": "TEST_01",
    "description": "단위 금액 정상 처리 및 한글 디버깅",
    "status": "PASS",
    "checked_at": "2026.06.21"
  },
  {
    "case_id": "TEST_02",
    "description": "비현실적 초대형 금액 입력 예외 마스킹 동작",
    "status": "PASS",
    "checked_at": "2026.06.21"
  }
]`,
                "analytics": `### 📈 실시간 운영 메트릭스
- **총 실행 수**: 8,921회
- **누적 다운로드 수**: 1,284회
- **평균 응답 지연**: 1.15초 (매우 쾌적)
- **최근 30일 실패율**: 3.8% (주로 필수 인풋 누락)

#### 부서별 실행 분포
- **경영기획부**: 48%
- **광양 제철소 본부**: 25%
- **전략기획실**: 18%
- **기타**: 9%`
            },
            // Fallbacks for other skills
            "generic": {
                "readme": `# 스킬 기본 정보 및 리드미
현재 선택한 스킬은 기획안에 정의된 구조를 완전하게 갖춘 포스코 사내용 검증된 AI 컴포넌트입니다.

## 특징
- 높은 신뢰도의 정형 데이터 연동
- 사내 보안 필터링 완료
- 손쉬운 Fork 및 커스터마이징 허용`,
                "use_cases": `### 활용 및 한계 영역
- 소속 부서 내 일상 반복 업무 조율에 적극 추천합니다.
- 외부 망으로 직접 고객 데이터 송출이 금지되어 있으므로 주의바랍니다.`,
                "skill_yaml": `name: "posco-generic-skill"\nversion: "1.0.0"\nstatus: "Beta"`,
                "input_schema": `{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  }\n}`,
                "system_prompt": `포스코 내부 윤리 규정과 영업 기밀 준수 가이드라인에 맞추어 전문적인 한글 답변을 구조화하여 출력하시오.`,
                "npv_calculator": `# Mock Module\nprint("Generic connector loaded.")`,
                "example_input": `{\n  "text": "인풋 샘플입니다."\n}`,
                "example_output": `### 출력 결과 예시\n본 양식에 따라 정상 작동된 결과 템플릿입니다.`,
                "test_cases": `[ { "case_id": "G_01", "status": "PASS" } ]`,
                "analytics": `### 통계 메트릭스\n- 실행 빈도: 일 평균 30건 이상\n- 평균 응답성: 1.5s`
            }
        };
