# PokéBattle KR — Pages (Korean-first, polished UI)
MIT License

## 특징
- 전면 한글 UI, 포켓몬식 한국어 대사 출력(예: “효과가 굉장했다!”, “급소에 맞았다!”).
- GitHub Pages에서 바로 동작(정적 호스팅).
- 포켓몬 1025마리 타입을 PokéAPI로 런타임 로드 후 localStorage 캐시.
- 공격/수비 엔트리 입력 → 기술 지시 입력 → 결과(대미지 범위, OHKO/2HKO 확률, 한국어 로그) + 히스토리.

## 배포
1) 저장소 루트에 업로드
2) Settings → Pages → Deploy from branch → main / root

## 주의
- 기술/타입 입력은 한글·영문 혼용 가능. 타입은 내부적으로 영문 키로 변환합니다.
- 스탯은 실능치(랭크/성격/EV/IV/도구/특성 반영 후)를 바로 입력합니다.
