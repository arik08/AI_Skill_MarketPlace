---
name: office-automation-request-triage
description: 현업 자동화 요청을 난이도, 기대효과, 데이터 접근성 기준으로 분류해 추진 우선순위를 제안합니다. Use when Codex needs to perform or assist with 경영기획 office work using this reusable skill.
---

# 사무 자동화 요청 분류 및 우선순위화

## Goal

현업 자동화 요청을 난이도, 기대효과, 데이터 접근성 기준으로 분류해 추진 우선순위를 제안합니다.

## Workflow

1. Read the user's request, business context, and attached material summary.
2. Identify missing inputs, sensitive information, and approval risks before drafting.
3. Produce a concise working output that can be pasted into a report, memo, review note, or meeting material.
4. Mark assumptions clearly and list follow-up checks when the source material is incomplete.

## Output Shape

- 핵심 요약
- 주요 판단 근거
- 리스크 및 확인 필요 사항
- 다음 액션 제안

## Guardrails

- Do not invent numeric facts, legal conclusions, or policy approvals.
- Flag 개인정보, 계약, 재무 수치, 인사 정보, and confidential material before reuse.
- Keep the tone practical, specific, and suitable for internal office work.
