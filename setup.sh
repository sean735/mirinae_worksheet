#!/usr/bin/env bash
set -euo pipefail

# ─── Mirinae Attendance System — One-shot Setup Script ───
# Run on a fresh WSL2 Ubuntu:  bash setup.sh

INSTALL_DIR="$HOME/mirinae-attendance"

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
ask()  { echo -en "${CYAN}[?]${NC} $1: "; }

# ─── 1. Gather Configuration ───
echo ""
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Mirinae 근태관리 시스템 설치 스크립트${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo ""

ask "Git 저장소 URL (HTTPS or SSH)"; read -r GIT_REPO
[ -z "$GIT_REPO" ] && err "Git 저장소 URL이 필요합니다"

ask "허용할 이메일 도메인 [mirinae.io]"; read -r ALLOWED_DOMAIN
ALLOWED_DOMAIN="${ALLOWED_DOMAIN:-mirinae.io}"

ask "앱 포트 [3000]"; read -r APP_PORT
APP_PORT="${APP_PORT:-3000}"

ask "ngrok 설치 및 설정할까요? [Y/n]"; read -r INSTALL_NGROK
INSTALL_NGROK="${INSTALL_NGROK:-Y}"

NGROK_TOKEN=""
if [[ ! "$INSTALL_NGROK" =~ ^[Nn] ]]; then
  ask "ngrok Authtoken (https://dashboard.ngrok.com/get-started/your-authtoken)"; read -r NGROK_TOKEN
fi

SESSION_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${YELLOW}── 설정 확인 ──${NC}"
echo "  저장소:        $GIT_REPO"
echo "  설치 경로:     $INSTALL_DIR"
echo "  허용 도메인:   @$ALLOWED_DOMAIN"
echo "  포트:          $APP_PORT"
echo "  ngrok:         $([[ ! "$INSTALL_NGROK" =~ ^[Nn] ]] && echo "설치" || echo "건너뜀")"
echo ""
ask "계속 진행할까요? [Y/n]"; read -r CONFIRM
[[ "$CONFIRM" =~ ^[Nn] ]] && err "취소되었습니다"

# ─── 2. Install System Dependencies ───
echo ""
log "시스템 패키지 업데이트 중..."
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl git > /dev/null

# ─── 3. Install Docker ───
if command -v docker &> /dev/null; then
  log "Docker가 이미 설치되어 있습니다: $(docker --version)"
else
  log "Docker 설치 중..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null
  sudo usermod -aG docker "$USER"
  log "Docker 설치 완료"
fi

# Ensure Docker daemon is running (WSL2 may need manual start)
if ! docker info &> /dev/null; then
  warn "Docker 데몬 시작 중..."
  sudo service docker start
  sleep 2
  docker info &> /dev/null || err "Docker 데몬을 시작할 수 없습니다. 'sudo service docker start'를 실행해주세요."
fi

# ─── 4. Install ngrok ───
if [[ ! "$INSTALL_NGROK" =~ ^[Nn] ]]; then
  if command -v ngrok &> /dev/null; then
    log "ngrok이 이미 설치되어 있습니다: $(ngrok version)"
  else
    log "ngrok 설치 중..."
    curl -fsSL https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-amd64.tgz | sudo tar -xz -C /usr/local/bin
    log "ngrok 설치 완료"
  fi

  if [ -n "$NGROK_TOKEN" ]; then
    ngrok config add-authtoken "$NGROK_TOKEN"
    log "ngrok authtoken 설정 완료"
  fi
fi

# ─── 5. Clone Repository ───
if [ -d "$INSTALL_DIR" ]; then
  warn "$INSTALL_DIR 가 이미 존재합니다. git pull 실행..."
  cd "$INSTALL_DIR"
  git pull
else
  log "저장소 클론 중..."
  git clone "$GIT_REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
log "프로젝트 디렉토리: $INSTALL_DIR"

# ─── 6. Generate .env ───
log ".env 파일 생성 중..."
cat > .env <<EOF
# ── MongoDB ──
MONGODB_URI=mongodb://mongodb:27017
MONGODB_DB=mirinae_attendance

# ── App ──
APP_BASE_URL=http://localhost:${APP_PORT}
DEFAULT_USER_ID=demo-user
ATTENDANCE_ARCHIVE_DIR=/app/data/attendance

# ── Auth ──
AUTH_SESSION_SECRET=${SESSION_SECRET}
ALLOWED_DOMAIN=${ALLOWED_DOMAIN}

# ── Backup ──
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=14

# ── Google Calendar (필요시 수정) ──
GOOGLE_CALENDAR_ENABLED=false
GOOGLE_CALENDAR_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
NEXT_PUBLIC_GOOGLE_TEAM_CALENDAR_ID=
EOF

# ─── 7. Update port if not default ───
if [ "$APP_PORT" != "3000" ]; then
  sed -i "s/\"3000:3000\"/\"${APP_PORT}:3000\"/" docker-compose.yml
fi

# ─── 8. Build & Start ───
log "Docker 이미지 빌드 중... (처음에는 몇 분 소요)"
docker compose build --quiet

log "서비스 시작 중..."
docker compose up -d

# ─── 9. Wait for Health Check ───
log "서비스 상태 확인 중..."
RETRIES=30
until curl -sf http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  [ $RETRIES -le 0 ] && { warn "헬스체크 타임아웃. 'docker compose logs app'으로 확인해주세요."; break; }
  sleep 2
done

if [ $RETRIES -gt 0 ]; then
  log "앱이 정상 실행 중입니다!"
fi

# ─── 10. Start ngrok ───
if [[ ! "$INSTALL_NGROK" =~ ^[Nn] ]] && command -v ngrok &> /dev/null; then
  echo ""
  log "ngrok 터널 시작 중..."
  ngrok http ${APP_PORT} --log=stdout > /tmp/ngrok.log 2>&1 &
  NGROK_PID=$!
  sleep 3

  # Get the public URL from ngrok API
  NGROK_URL=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

  if [ -n "$NGROK_URL" ]; then
    log "ngrok 터널 활성화!"
    echo ""
    echo -e "  ${GREEN}외부 접속 URL:   ${NGROK_URL}${NC}"
    echo ""
  else
    warn "ngrok URL을 가져올 수 없습니다. 수동 확인: http://localhost:4040"
  fi
fi

# ─── 11. Print Summary ───
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  설치 완료!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "  로컬 URL:      http://localhost:${APP_PORT}"
if [ -n "${NGROK_URL:-}" ]; then
  echo "  외부 URL:      ${NGROK_URL}"
fi
echo "  설치 경로:     $INSTALL_DIR"
echo "  허용 도메인:   @$ALLOWED_DOMAIN"
echo ""
echo -e "  ${YELLOW}관리 명령어:${NC}"
echo "    cd $INSTALL_DIR"
echo "    docker compose logs -f app    # 앱 로그 확인"
echo "    docker compose restart app    # 앱 재시작"
echo "    docker compose down           # 전체 중지"
echo "    docker compose up -d          # 전체 시작"
if [[ ! "$INSTALL_NGROK" =~ ^[Nn] ]]; then
  echo ""
  echo -e "  ${YELLOW}ngrok 명령어:${NC}"
  echo "    ngrok http ${APP_PORT}              # 터널 재시작"
  echo "    http://localhost:4040          # ngrok 대시보드"
fi
echo ""
