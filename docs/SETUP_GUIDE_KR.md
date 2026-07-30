# WorldNest Online - 개발자 환경 설정 가이드

> 이 문서는 WorldNest Online 프로젝트를 로컬에서 실행하기 위해 개발자가 직접 수행해야 하는 모든 설정 단계를 안내합니다.

---

## 목차

1. [사전 준비 사항](#1-사전-준비-사항)
2. [Supabase 프로젝트 생성](#2-supabase-프로젝트-생성)
3. [데이터베이스 테이블 생성](#3-데이터베이스-테이블-생성)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [프로젝트 설치 및 실행](#5-프로젝트-설치-및-실행)
6. [동작 확인](#6-동작-확인)
7. [자주 발생하는 문제와 해결 방법](#7-자주-발생하는-문제와-해결-방법)
8. [Vercel 배포 (선택사항)](#8-vercel-배포-선택사항)

---

## 1. 사전 준비 사항

아래 소프트웨어를 먼저 설치하세요.

| 소프트웨어 | 최소 버전 | 설치 방법 |
|-----------|----------|-----------|
| Node.js | 22 이상 | https://nodejs.org 에서 LTS 다운로드 |
| pnpm | 10 이상 | 터미널에서 `corepack enable` 실행 |
| Git | 최신 버전 | https://git-scm.com |
| 브라우저 | Chrome/Edge/Firefox 최신 | - |

### Node.js 설치 확인

```bash
node --version
# v22.x.x 이상이어야 합니다
```

### pnpm 활성화

```bash
corepack enable
pnpm --version
# 10.x.x 이상이어야 합니다
```

---

## 2. Supabase 프로젝트 생성

Supabase는 이 게임의 **백엔드** 역할을 합니다 (인증, 데이터베이스, 실시간 통신).

### 단계별 안내

1. **https://supabase.com** 접속
2. **Sign Up** 클릭하여 계정 생성 (GitHub 계정으로 가능)
3. 로그인 후 **New Project** 클릭
4. 프로젝트 정보 입력:
   - **Name**: `worldnest-online` (원하는 이름)
   - **Database Password**: 안전한 비밀번호 입력 (꼭 기억해두세요!)
   - **Region**: 가장 가까운 지역 선택 (예: `Northeast Asia (Tokyo)`)
5. **Create new project** 클릭
6. 프로젝트 생성 완료까지 약 1~2분 대기

### API 키 확인

프로젝트가 생성되면:

1. 왼쪽 메뉴에서 **Settings** (⚙️ 아이콘) 클릭
2. **API** 탭 클릭
3. 아래 두 값을 복사해두세요:

| 항목 | 위치 | 예시 |
|------|------|------|
| **Project URL** | `URL` 섹션 | `https://abcdefgh.supabase.co` |
| **anon public** | `Project API keys` 섹션 | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

> ⚠️ **주의**: `service_role` 키는 절대 사용하지 마세요! `anon` 키만 사용합니다.

---

## 3. 데이터베이스 테이블 생성

게임에 필요한 테이블을 Supabase에 생성해야 합니다.

### 단계별 안내

1. Supabase 대시보드에서 왼쪽 메뉴의 **SQL Editor** 클릭
2. **New query** 클릭
3. 아래 SQL을 **전체 복사**하여 붙여넣기:

```sql
-- WorldNest Online - Initial Database Schema
create extension if not exists "uuid-ossp";

-- 프로필 테이블 (사용자 계정과 연결)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar text default 'default',
  created_at timestamptz default now() not null
);

-- 플레이어 상태 테이블 (마지막 위치, 인벤토리 저장)
create table public.player_state (
  player_id uuid references public.profiles(id) on delete cascade primary key,
  x real default 0 not null,
  y real default 0 not null,
  chunk text default '0,0' not null,
  last_online timestamptz default now() not null,
  inventory jsonb default '{}' not null
);

-- 월드 테이블
create table public.worlds (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  seed integer not null,
  created_at timestamptz default now() not null
);

-- RLS(행 수준 보안) 활성화
alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.worlds enable row level security;

-- 프로필 정책
create policy "Users can view all profiles"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- 플레이어 상태 정책
create policy "Users can view their own player state"
  on public.player_state for select using (auth.uid() = player_id);

create policy "Users can update their own player state"
  on public.player_state for update using (auth.uid() = player_id);

create policy "Users can insert their own player state"
  on public.player_state for insert with check (auth.uid() = player_id);

-- 월드 정책
create policy "Anyone can view worlds"
  on public.worlds for select using (true);

create policy "Authenticated users can create worlds"
  on public.worlds for insert with check (auth.role() = 'authenticated');

-- 기본 월드 삽입
insert into public.worlds (name, seed) values ('Default World', 42);
```

4. **Run** 버튼 클릭 (또는 Ctrl+Enter)
5. "Success. No rows returned" 메시지가 나오면 성공!

### 두 번째 마이그레이션 실행 (필수)

게임플레이(지형 변경, 건축물, 농작물, 채팅)를 저장하려면 **두 번째 마이그레이션도 반드시** 실행해야 합니다.

1. 저장소의 `packages/database/supabase/migrations/002_gameplay_schema.sql` 파일을 텍스트 에디터로 열기
2. 내용을 **전체 복사**
3. Supabase **SQL Editor** → **New query** 에 붙여넣고 **Run** 클릭

이 마이그레이션이 만드는 것:

| 항목 | 설명 |
|------|------|
| `handle_new_user()` 트리거 | 회원가입 시 `profiles`와 `player_state` 행을 자동 생성합니다. 이것이 없으면 저장 기능이 전혀 동작하지 않습니다. |
| `world_modifications` | 플레이어가 변경한 타일만 저장 (지형 자체는 시드로 재생성) |
| `structures` | 설치한 울타리·상자 등 건축물 |
| `crops` | 심은 작물 (씨앗 종류 + 심은 시각) |
| `chat_messages` | 채팅 기록 |

> ⚠️ `001` → `002` 순서로 실행해야 합니다. 순서를 바꾸면 외래 키 오류가 발생합니다.

### 확인 방법

왼쪽 메뉴에서 **Table Editor** 클릭 → `profiles`, `player_state`, `worlds`, `world_modifications`, `structures`, `crops`, `chat_messages` 7개 테이블이 보이면 정상입니다.

---

## 4. 환경 변수 설정

### 단계별 안내

1. 프로젝트 루트 폴더에서 `.env.example` 파일을 복사:

```bash
cp .env.example .env.local
```

2. `.env.local` 파일을 텍스트 에디터로 열기
3. 아래와 같이 수정:

```env
NEXT_PUBLIC_SUPABASE_URL=https://여기에-본인-프로젝트-URL.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에-본인-anon-key-붙여넣기
```

### 예시 (실제 값으로 교체해야 함)

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5OTk5OTksImV4cCI6MjAxNTU3NTk5OX0.xxxxx
```

> ⚠️ `.env.local` 파일은 **절대 GitHub에 올리지 마세요!** (이미 `.gitignore`에 등록되어 있습니다)

---

## 5. 프로젝트 설치 및 실행

```bash
# 1. 저장소 클론 (이미 했다면 건너뛰기)
git clone https://github.com/musclebreadbread-stack/WorldNest-Online.git
cd WorldNest-Online

# 2. feat/mvp-foundation 브랜치로 전환
git checkout feat/mvp-foundation

# 3. 모든 패키지 의존성 설치
pnpm install

# 4. 환경 변수 설정 (위 4번 단계 완료 확인)

# 5. 개발 서버 시작
pnpm dev
```

### 성공 시 표시되는 메시지

```
@worldnest/web:dev: ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### 브라우저에서 확인

- **http://localhost:3000** 접속
- 로그인 페이지(`/auth`)가 표시되면 성공!
- "Missing Supabase URL or anon key" 에러가 **사라져야** 합니다

---

## 6. 동작 확인

### 회원가입 테스트

1. http://localhost:3000/auth 접속
2. Username, Email, Password 입력
3. **Sign Up** 클릭
4. 회원가입 성공 시 자동으로 `/game` 페이지로 이동

> 💡 **팁**: Supabase 기본 설정에서는 이메일 인증이 필요할 수 있습니다.
> 개발 중에는 Supabase 대시보드 → Authentication → Settings → **Confirm email** 을 OFF로 설정하면 편합니다.

### 이메일 인증 끄기 (개발용)

1. Supabase 대시보드 접속
2. **Authentication** → **Providers** 클릭
3. **Email** 제공자 클릭
4. **Confirm email** 토글을 **OFF**로 변경
5. **Save** 클릭

### 게임 화면 확인

회원가입/로그인 성공 후 `/game` 페이지에서:
- 초록색/갈색/파란색 타일로 구성된 월드가 표시됨
- WASD 또는 화살표 키로 캐릭터 이동 가능 (물 타일은 통과되지 않음)
- 이동하면 주변 청크가 자동으로 로드됨
- 화면 상단에 `Day 1 · 07:20 · dawn` 형식의 월드 시계가 표시됨

### 조작 방법

| 키 | 동작 |
|----|------|
| `WASD` / 화살표 | 이동 |
| `1`~`8` | 핫바 슬롯 선택 |
| `I` | 인벤토리 열기/닫기 |
| `E` / `Space` | 바라보는 타일과 상호작용 (채집 / 밭 갈기 / 씨앗 심기 / 수확) |
| `B` | 건축 모드 전환 |
| `Q` / 마우스 좌클릭 | 선택한 아이템 설치 (건축 모드에서만) |
| `M` | 우측 상단 미니맵 켜기/끄기 |
| `J` | 퀘스트 목록 열기/닫기 |
| `P` | 설정 패널 열기/닫기 (언어·소리 설정) |
| `1`~`4` | 대화 중 선택지 고르기 |
| `Esc` | 맨 위에 열린 창 닫기 (대화 → 상점 → 퀘스트 → 인벤토리 → 설정 → 건축 모드 순) |
| `Enter` / `Esc` | 채팅 입력창 포커스 / 해제 |

마을에는 NPC 3명이 있습니다. `E` 키로 말을 걸 수 있습니다.

| NPC | 역할 |
|-----|------|
| 정원사 핍 | 농사 안내 (대화만) |
| 상점 주인 주노 | 상점 열기. 가격은 고정이며 판매가는 항상 구매가보다 낮습니다(무한 차익 거래 불가). 플레이어 간 거래는 없습니다. |
| 탐험가 에이다 | 퀘스트 3개 수령·보고 (`J` 키로 진행 상황 확인) |

### 언어 설정

UI는 12개 언어(en, ko, ja, zh, es, fr, de, pt, ar, hi, th, vi)를 지원합니다. 첫 접속 시
브라우저 언어를 자동으로 감지하고, `P` 키 또는 우측 상단 설정 버튼에서 직접 바꿀 수 있습니다.
선택한 언어는 해당 기기에만 저장되며(`localStorage`), 아랍어는 오른쪽에서 왼쪽으로 표시됩니다.

### 저장 기능 확인 (마이그레이션 002 필요)

1. 캐릭터를 이동시키고 나무/돌을 채집
2. 브라우저를 새로고침(F5)
3. 마지막 위치와 인벤토리가 그대로 복원되면 정상입니다

### 멀티플레이 확인

1. 브라우저 탭 두 개(또는 시크릿 창)에서 서로 다른 계정으로 로그인
2. 한쪽에서 이동하면 다른 쪽 화면에서 이름표가 붙은 캐릭터가 따라 움직임
3. 한쪽에서 채팅을 보내면 다른 쪽에 즉시 표시되고, 새로고침해도 기록이 남아 있어야 합니다

---

## 7. 자주 발생하는 문제와 해결 방법

### "Missing Supabase URL or anon key" 에러

**원인**: `.env.local` 파일이 없거나 값이 비어 있음

**해결**:
1. 프로젝트 루트에 `.env.local` 파일이 있는지 확인
2. `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 값이 올바른지 확인
3. 개발 서버를 재시작 (`Ctrl+C` 후 `pnpm dev`)

### "relation "public.profiles" does not exist" 에러

**원인**: 데이터베이스 테이블이 생성되지 않음

**해결**: 3번 단계의 SQL(`001` → `002` 순서)을 Supabase SQL Editor에서 다시 실행

### pnpm install 실패

**원인**: Node.js 버전이 낮거나 pnpm이 설치되지 않음

**해결**:
```bash
node --version  # 22 이상 확인
corepack enable
pnpm install
```

### 회원가입 후 로그인이 안 됨

**원인**: 이메일 인증이 필요한 상태

**해결**: Supabase 대시보드 → Authentication → Settings → Confirm email → OFF

### 이동/채집한 내용이 새로고침하면 사라짐

**원인**: 마이그레이션 `002`가 실행되지 않아 `profiles` 행이 만들어지지 않음

**해결**: 3번 단계의 `002_gameplay_schema.sql`을 실행한 뒤 **다시 회원가입**하세요.
트리거는 실행된 이후에 생성되는 계정에만 적용됩니다.
(기존 계정은 Supabase → Authentication → Users 에서 삭제 후 재가입하면 됩니다)

### 게임 화면이 검은색으로 나옴

**원인**: Phaser 렌더링 오류 (보통 브라우저 확장 프로그램 충돌)

**해결**:
1. 브라우저 개발자 도구(F12) → Console 탭에서 에러 확인
2. 시크릿 모드(Ctrl+Shift+N)에서 재시도
3. WebGL이 지원되는 브라우저인지 확인

### 포트 3000이 이미 사용 중

**해결**:
```bash
# 기존 프로세스 종료
npx kill-port 3000

# 또는 다른 포트로 실행
PORT=3001 pnpm dev
```

---

## 8. Vercel 배포 (선택사항)

게임을 인터넷에 공개하려면 Vercel에 배포할 수 있습니다.

### 단계별 안내

1. https://vercel.com 가입 (GitHub 계정으로)
2. **New Project** → GitHub 저장소 선택
3. **Framework Preset**: `Next.js` 선택
4. **Root Directory**: `apps/web` 입력
5. **Environment Variables** 설정:
   - `NEXT_PUBLIC_SUPABASE_URL` = 본인 Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 본인 anon key
6. **Deploy** 클릭

### Build 설정

| 항목 | 값 |
|------|-----|
| Build Command | `cd ../.. && pnpm build --filter @worldnest/web` |
| Output Directory | `.next` |
| Install Command | `cd ../.. && pnpm install` |

---

## 체크리스트 요약

아래 항목을 모두 완료했는지 확인하세요:

- [ ] Node.js 22+ 설치됨
- [ ] pnpm 10+ 활성화됨 (`corepack enable`)
- [ ] Supabase 프로젝트 생성됨
- [ ] Supabase에서 마이그레이션 `001` 실행됨 (테이블 3개 생성)
- [ ] Supabase에서 마이그레이션 `002` 실행됨 (테이블 7개 + 회원가입 트리거)
- [ ] `.env.local` 파일에 Supabase URL과 anon key 입력됨
- [ ] `pnpm install` 성공
- [ ] `pnpm dev` 실행 후 http://localhost:3000 접속 가능
- [ ] 회원가입 및 로그인 정상 동작
- [ ] `/game` 페이지에서 월드 표시됨

---

## 기술 지원

문제가 해결되지 않으면:

1. GitHub Issues에 버그 리포트 작성
2. 브라우저 콘솔 에러 메시지 포함
3. `.env.local` 값은 **절대 공유하지 마세요**

---

*이 문서는 WorldNest Online MVP (feat/mvp-foundation) 기준으로 작성되었습니다.*
