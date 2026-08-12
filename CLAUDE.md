# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projects in This Workspace

모든 Claude Code 프로젝트는 `./Projects/` 아래에 모여 있음 (2026-08-12 정리).

### 1. TravelApp (`./Projects/TravelApp/`)
React Native + Expo v56 여행 커뮤니티 앱. 앱 이름: **트래블시커**.
5탭 (홈/커뮤니티/중고거래/패키지/마이) + Firebase Auth/Firestore/Storage 연동 완료.
상세 내용은 `Projects/TravelApp/CLAUDE.md` 참조. 개발 세션 보고서/기획 문서는 `Projects/TravelApp/docs/`에 모아둠.

> **Expo API 주의:** Expo는 버전마다 API가 다름. TravelApp 코드 작성 전 반드시 https://docs.expo.dev/versions/v56.0.0/ 기준 확인. 테스트 파일 없음 — `npx expo start --web` 또는 에뮬레이터로 직접 확인.

### 2. Stock Analyst Agent (`./Projects/stock-agent/`)
Claude 서브에이전트 기반 주식 종합 분석 시스템. 코드 없음 — Markdown 에이전트 정의 파일만 존재.

**실행 방법:** Claude Code 채팅에서 아래처럼 입력하면 됨.
```
/agent Projects/stock-agent/files/stock-analyst.md
삼성전자 분석해줘
```
또는 프롬프트에 파일을 직접 드래그하거나 `@Projects/stock-agent/files/stock-analyst.md` 형태로 참조 후 종목 입력.

**입력 형식:**
```
"삼성전자 분석해줘"          # 단일 종목
"NVDA vs AMD 비교 분석"     # 비교 분석 (두 종목 각각 파이프라인 실행 후 비교)
"AI 반도체 top pick 골라줘"  # 섹터/테마 → 3~5개 종목 선별 후 각각 분석
```

**필요 툴 권한:** `web_search`, `web_fetch` (YAML frontmatter에 선언됨)

**파일 구조 (`files/` 디렉토리, 모두 동일 레벨에 위치):**
| 파일 | 역할 |
|------|------|
| `stock-analyst.md` | 오케스트레이터 — 입력 파싱 + 6단계 파이프라인 조율 |
| `company-overview.md` | Step 1 — 기업 개요, 사업 모델, 경쟁 포지션 |
| `financial-analysis.md` | Step 2 — 재무제표, 밸류에이션, 수익성 |
| `industry-analysis.md` | Step 3 — 산업 트렌드, TAM/SAM, 경쟁사 비교 |
| `momentum-analysis.md` | Step 4 — 주가 모멘텀, 수급, 이벤트 캘린더 |
| `risk-analysis.md` | Step 5 — 리스크 요인 (반드시 Step 2~4 결과 참조 후 실행) |
| `synthesis-recommendation.md` | Step 6 — 투자의견, 목표가, 종합 리포트 |

