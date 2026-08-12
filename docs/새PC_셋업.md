# 새 PC에서 Claude Code 프로젝트 이어서 쓰기

## 1단계 — Git 설치
PowerShell(관리자 아니어도 됨)에서 실행. 설치 중 UAC 창이 뜨면 "예" 눌러주면 됨.

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

설치 후 **PowerShell 창을 껐다가 새로 열어야** git 명령이 인식됩니다.

## 2단계 — SSH 키 생성
새 PowerShell 창에서:

```powershell
ssh-keygen -t ed25519 -C "claude-code-$env:COMPUTERNAME"
```

파일 경로/비밀번호 물어보면 **그냥 Enter 3번** (기본 경로, 비밀번호 없음).

## 3단계 — 공개키를 GitHub에 등록 (직접 해야 하는 유일한 부분)

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

출력된 문자열을 통째로 복사 → https://github.com/settings/ssh/new 접속 → Title에 PC 이름 적당히 입력 → Key 칸에 붙여넣기 → **Add SSH key**

## 4단계 — 연결 확인

```powershell
ssh -T git@github.com
```

`Hi bluelyslobi! You've successfully authenticated...` 메시지 나오면 성공.

## 5단계 — 프로젝트 받기

```powershell
git clone git@github.com:bluelyslobi/developing.git "$env:USERPROFILE\Projects"
```

## 6단계 — 홈 폴더 CLAUDE.md 연결 파일 생성
(Projects 폴더 밖에 있는 파일이라 git으로 안 따라오므로 한 번만 수동으로)

```powershell
Set-Content -Path "$env:USERPROFILE\CLAUDE.md" -Value "@Projects/CLAUDE.md" -NoNewline -Encoding utf8
```

## 7단계 — TravelApp 실행 준비
Node.js가 없다면 먼저 설치:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
```

새 PowerShell 창에서:

```powershell
cd "$env:USERPROFILE\Projects\TravelApp"
npm install
npx expo start --web
```

---

## 이후 작업 습관
- 작업 시작 전: `git pull` (Projects 폴더에서)
- 작업 끝나고: `git add -A; git commit -m "메시지"; git push`
