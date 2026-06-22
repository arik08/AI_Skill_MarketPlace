---
name: travel-expense-receipt-gap-detection
description: 출장비 정산 내역과 영수증 첨부 현황을 대조해 누락 증빙과 비정상 금액을 표시합니다. Use when Codex needs to perform or assist with 재무 office work using this reusable skill.
---

# 출장비 정산 증빙 누락 탐지

## Goal

출장비 정산 내역과 영수증 첨부 현황을 대조해 누락 증빙과 비정상 금액을 표시합니다.

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
