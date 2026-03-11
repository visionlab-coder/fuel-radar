# Fuel Radar MVP

위치 기반 반경 10km 최저가 주유소 탐색 + 2주 전 대비 유가 변화(전국 평균) 표시 MVP입니다.

## 1) 핵심 기능

- 현재 위치 기준 반경 N km(기본 10km) 주유소 가격 조회
- 위치 권한 허용 시 자동 위치 고정 + 주소/지명 검색으로 위치 전환
- 최저가 1곳 강조 + 가격순 리스트
- 유종 전환(휘발유/경유)
- 비교 기준 전환(1/3/7/14일 전 대비)
- 최근 일별 변동(최근 5개 구간) 표시
- 실시간 자동 새로고침(30/60/120초)
- 위치 권한 승인 시 Live Radar Scan 애니메이션 + 주변 주유소 blip 표시
- Smart Save Radar: 주유량/연비를 반영한 실질 절약 추천
- 리스트 정렬 전환: 가격순 / 실질절약순
- 가격 이상 신고: 사진 촬영/첨부 + 신고 초안 생성 + 신문고 이동 링크
  - 사진 업로드 권장: 3MB 이하

## 2) 기술 구성

- Frontend: 순수 HTML/CSS/JS (모바일 우선)
- Backend: Vercel Serverless Functions (`/api/stations`, `/api/trend`)
- Data: 오피넷 OpenAPI
- 호출 최적화: 서버 캐시 적용 (`stations` 120초, `trend` 1800초)

## 3) 환경 변수

`.env.example`를 참고해 아래 값을 설정하세요.

- `OPINET_API_KEY`: 오피넷 API 인증키
- `OPINET_BASE_URL`: 기본값 `http://www.opinet.co.kr/api`

## 4) 로컬 실행

Vercel 개발 서버를 사용하면 API와 정적 파일을 함께 확인할 수 있습니다.

```bash
cd fuel-price-mvp
npm i -g vercel
vercel dev
```

브라우저에서 `http://localhost:3000` 접속 후 위치 권한을 허용하세요.

API 키 없이 화면만 즉시 확인하려면 데모 모드를 사용하세요.

`http://localhost:3000/?demo=1`

## 5) 배포 (Vercel)

```bash
cd fuel-price-mvp
vercel
```

배포 중 또는 배포 후 프로젝트 설정에서 환경 변수 `OPINET_API_KEY`를 등록하세요.

## 6) 즉시 확장할 TODO

- 주유소별 2주 전 비교: 스냅샷 저장용 DB(Supabase/Neon) + 스케줄러(1시간 단위)
- 지도 시각화: Kakao/Google Maps SDK로 카드-지도 동기화
- 즐겨찾기/알림: 가격 임계치 하락 시 푸시 알림
- 캐싱: Edge cache(60~120초)로 응답 속도 개선
- 신문고 정식 연동: 기관 제공 인증/연계 정책 확인 후 API 또는 RPA 기반 자동 제출 고도화
