# 📊 Stock Analyst AI Agent

증권사 애널리스트 수준의 종목 분석을 수행하는 AI 에이전트 시스템입니다.
Anthropic 공식 서브에이전트 가이드(YAML frontmatter + Markdown)를 따릅니다.

## 아키텍처

```
stock-analyst.md (오케스트레이터)
│
├── agents/company-overview.md      ← Step 1: 기업 개요
├── agents/financial-analysis.md    ← Step 2: 재무 분석
├── agents/industry-analysis.md     ← Step 3: 산업 분석
├── agents/momentum-analysis.md     ← Step 4: 모멘텀 분석
├── agents/risk-analysis.md         ← Step 5: 리스크 분석
└── agents/synthesis-recommendation.md ← Step 6: 종합 의견 & 추천
```

## 파이프라인 흐름

```
[사용자: "삼성전자 분석해줘"]
        │
        ▼
  ┌─ 오케스트레이터 ─────────────────────────────┐
  │                                               │
  │  1. company-overview    → 기업 프로파일        │
  │  2. financial-analysis  → 재무 건전성 평가      │
  │  3. industry-analysis   → 산업 매력도 평가      │
  │  4. momentum-analysis   → 수급·촉매 분석        │
  │  5. risk-analysis       → 리스크 매트릭스       │  ← 2~4 결과 참조
  │  6. synthesis           → 스코어카드 + 추천     │  ← 1~5 결과 종합
  │                                               │
  └───────────────────────────────────────────────┘
        │
        ▼
  [최종 분석 리포트 + 투자의견 + 목표가]
```

## 사용법

### 1. 단일 종목 분석
```
"삼성전자 분석해줘"
"NVDA 종합 분석 부탁해"
"Tesla 투자해도 될까?"
```

### 2. 섹터/테마 분석 → 추천픽 선정
```
"2차전지 관련주 중 추천픽 골라줘"
"AI 반도체 섹터 top pick은?"
"배당주 중에서 매력적인 종목 3개 추천해줘"
```

### 3. 비교 분석
```
"삼성전자 vs SK하이닉스 비교 분석"
"NVDA vs AMD vs INTC 누가 제일 나아?"
```

## 에이전트별 상세

| 에이전트 | 핵심 산출물 | 주요 데이터 소스 |
|---------|-----------|----------------|
| company-overview | 사업 모델, MOAT, 경쟁 포지션 | IR, DART/EDGAR, 뉴스 |
| financial-analysis | 재무 지표, 밸류에이션 멀티플 | 재무제표, FnGuide, Yahoo Finance |
| industry-analysis | TAM/SAM, Porter's 5F, 경쟁사 비교 | 산업 리포트, 시장조사 기관 |
| momentum-analysis | 수급, 촉매, 이벤트 캘린더 | 거래소 데이터, 증권사 리포트 |
| risk-analysis | 리스크 매트릭스, 시나리오 분석 | 10-K Risk Factors, 뉴스, 소송 정보 |
| synthesis-recommendation | 스코어카드, 투자의견, 목표가 | 전 단계 결과 종합 |

## 면책 고지

⚠️ 본 에이전트 시스템은 공개 정보를 기반으로 AI가 생성한 참고 자료를 제공합니다.
투자 권유가 아니며, 투자 판단과 그에 따른 손실은 전적으로 투자자 본인의 책임입니다.
