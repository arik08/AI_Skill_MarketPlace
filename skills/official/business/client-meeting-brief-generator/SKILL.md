---
name: client-meeting-brief-generator
description: 고객사 기본 정보, 최근 이슈, 과거 논의사항을 묶어 영업/사업 담당자용 미팅 준비 메모를 만듭니다. Use when Codex needs to perform or assist with 사업관리 office work using this reusable skill.
---

# 고객사 미팅 준비 메모 생성

## Goal

고객사 기본 정보, 최근 이슈, 과거 논의사항을 묶어 영업/사업 담당자용 미팅 준비 메모를 만듭니다.

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
