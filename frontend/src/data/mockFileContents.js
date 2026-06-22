window.MOCK_FILE_CONTENTS = {
    generic: {
        skill_md: `---
name: imported-office-skill
description: 외부에서 추가된 스킬입니다. SKILL.md 또는 skill.json을 보완하면 마켓플레이스 정보가 갱신됩니다.
---

# Imported Office Skill

이 스킬은 백엔드 API를 사용할 수 없을 때 표시되는 fallback 안내입니다.

실제 실행 환경에서는 \`skills/**/SKILL.md\`와 \`skills/**/skill.json\`을 재귀적으로 읽어 이 영역에 실제 파일 내용을 표시합니다.`
    }
};
