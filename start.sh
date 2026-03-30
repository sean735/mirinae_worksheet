#!/usr/bin/env bash
set -euo pipefail

# ─── Mirinae Attendance System — Quick Start ───
# Run after setup.sh has been run once:  bash start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }

APP_PORT="${APP_PORT:-3000}"

# ─── 1. Start Docker ───
if ! docker info &> /dev/null; then
  warn "Docker 데몬 시작 중..."
  sudo service docker start
  sleep 2
fi

# ─── 2. Start app ───
log "서비스 시작 중..."
docker compose up -d

# ─── 3. Health check ───
RETRIES=30
until curl -sf http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  [ $RETRIES -le 0 ] && { warn "헬스체크 타임아웃."; break; }
  sleep 2
done
[ $RETRIES -gt 0 ] && log "앱 실행 중: http://localhost:${APP_PORT}"

# ─── 4. Start ngrok ───
if command -v ngrok &> /dev/null; then
  # Kill existing ngrok if running
  pkill -f "ngrok http" 2>/dev/null || true
  sleep 1

  ngrok http ${APP_PORT} --log=stdout > /tmp/ngrok.log 2>&1 &
  sleep 3

  NGROK_URL=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

  if [ -n "$NGROK_URL" ]; then
    echo ""
    log "ngrok 터널 활성화!"
    echo ""
    echo -e "  ${GREEN}외부 접속 URL: ${NGROK_URL}${NC}"
    echo ""
    echo "  ngrok 대시보드: http://localhost:4040"
  else
    warn "ngrok URL 확인: http://localhost:4040"
  fi
else
  warn "ngrok이 설치되지 않았습니다. setup.sh를 먼저 실행해주세요."
fi
