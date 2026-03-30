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

ask "도메인 (예: attendance.mirinae.io, 없으면 Enter)"; read -r DOMAIN
ask "Google OAuth Client ID"; read -r OAUTH_CLIENT_ID
ask "Google OAuth Client Secret"; read -r OAUTH_CLIENT_SECRET
ask "허용할 Google 도메인 [mirinae.io]"; read -r ALLOWED_DOMAIN
ALLOWED_DOMAIN="${ALLOWED_DOMAIN:-mirinae.io}"

if [ -n "$DOMAIN" ]; then
  BASE_URL="https://${DOMAIN}"
else
  BASE_URL="http://localhost:3000"
  warn "도메인 없이 localhost 모드로 설치합니다"
fi

REDIRECT_URI="${BASE_URL}/api/auth/google/callback"
SESSION_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${YELLOW}── 설정 확인 ──${NC}"
echo "  저장소:        $GIT_REPO"
echo "  설치 경로:     $INSTALL_DIR"
echo "  도메인:        ${DOMAIN:-없음 (localhost)}"
echo "  Base URL:      $BASE_URL"
echo "  Redirect URI:  $REDIRECT_URI"
echo "  허용 도메인:   $ALLOWED_DOMAIN"
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

# ─── 4. Clone Repository ───
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

# ─── 5. Generate .env ───
log ".env 파일 생성 중..."
cat > .env <<EOF
# ── MongoDB ──
MONGODB_URI=mongodb://mongodb:27017
MONGODB_DB=mirinae_attendance

# ── App ──
APP_BASE_URL=${BASE_URL}
DEFAULT_USER_ID=demo-user
ATTENDANCE_ARCHIVE_DIR=/app/data/attendance

# ── Auth ──
AUTH_SESSION_SECRET=${SESSION_SECRET}
ALLOWED_GOOGLE_DOMAIN=${ALLOWED_DOMAIN}
GOOGLE_OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID}
GOOGLE_OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}
GOOGLE_OAUTH_REDIRECT_URI=${REDIRECT_URI}

# ── Backup ──
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=14

# ── Google Calendar (비활성화 상태, 필요시 수정) ──
GOOGLE_CALENDAR_ENABLED=false
GOOGLE_CALENDAR_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
NEXT_PUBLIC_GOOGLE_TEAM_CALENDAR_ID=
EOF

# ─── 6. Setup Caddy (if domain provided) ───
if [ -n "$DOMAIN" ]; then
  log "Caddy 리버스 프록시 설정 중..."

  cat > Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy app:3000
}
EOF

  # Patch docker-compose.yml to add Caddy service + volume
  if ! grep -q "caddy:" docker-compose.yml; then
    log "docker-compose.yml에 Caddy 서비스 추가 중..."

    # Add caddy service before the volumes: section
    sed -i '/^volumes:/i \
  caddy:\
    image: caddy:2-alpine\
    container_name: mirinae-caddy\
    restart: unless-stopped\
    ports:\
      - "80:80"\
      - "443:443"\
      - "443:443/udp"\
    volumes:\
      - ./Caddyfile:/etc/caddy/Caddyfile:ro\
      - caddy_data:/data\
      - caddy_config:/config\
    depends_on:\
      - app\
' docker-compose.yml

    # Add caddy volumes
    echo "  caddy_data:" >> docker-compose.yml
    echo "  caddy_config:" >> docker-compose.yml
  fi

  # Remove port 3000 exposure from app service (Caddy handles it)
  sed -i '/- "3000:3000"/d' docker-compose.yml
fi

# ─── 7. Build & Start ───
log "Docker 이미지 빌드 중... (처음에는 몇 분 소요)"
docker compose build --quiet

log "서비스 시작 중..."
docker compose up -d

# ─── 8. Wait for Health Check ───
log "서비스 상태 확인 중..."
RETRIES=30
until curl -sf http://localhost:3000/api/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  [ $RETRIES -le 0 ] && { warn "헬스체크 타임아웃. 'docker compose logs app'으로 확인해주세요."; break; }
  sleep 2
done

if [ $RETRIES -gt 0 ]; then
  log "앱이 정상 실행 중입니다!"
fi

# ─── 9. Print Summary ───
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  설치 완료!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "  앱 URL:        $BASE_URL"
echo "  설치 경로:     $INSTALL_DIR"
echo ""
echo -e "  ${YELLOW}관리 명령어:${NC}"
echo "    cd $INSTALL_DIR"
echo "    docker compose logs -f app    # 로그 확인"
echo "    docker compose restart app    # 앱 재시작"
echo "    docker compose down           # 전체 중지"
echo "    docker compose up -d          # 전체 시작"
echo ""

if [ -n "$DOMAIN" ]; then
  echo -e "  ${YELLOW}Google Cloud Console에서 설정 필요:${NC}"
  echo "    1. OAuth 2.0 승인된 리디렉션 URI에 추가:"
  echo "       ${REDIRECT_URI}"
  echo "    2. 승인된 JavaScript 원본에 추가:"
  echo "       ${BASE_URL}"
  echo ""
fi

# ─── 10. WSL Port Forwarding Note ───
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo -e "  ${YELLOW}[WSL] Windows에서 포트 포워딩이 필요합니다.${NC}"
  echo "  PowerShell(관리자)에서 다음 명령어를 실행하세요:"
  echo ""
  WSL_IP=$(hostname -I | awk '{print $1}')
  if [ -n "$DOMAIN" ]; then
    echo "    netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=${WSL_IP}"
    echo "    netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=443 connectaddress=${WSL_IP}"
    echo ""
    echo "  Windows 방화벽에서 80, 443 포트를 열어주세요:"
    echo "    New-NetFirewallRule -DisplayName 'Mirinae HTTP' -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow"
    echo "    New-NetFirewallRule -DisplayName 'Mirinae HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow"
  else
    echo "    netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=${WSL_IP}"
    echo ""
    echo "  Windows 방화벽에서 3000 포트를 열어주세요:"
    echo "    New-NetFirewallRule -DisplayName 'Mirinae App' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow"
  fi
  echo ""
  warn "WSL IP가 재부팅 시 변경될 수 있습니다. 변경 시 위 명령어를 다시 실행하세요."
  echo ""
fi
