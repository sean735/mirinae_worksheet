#!/bin/bash
# 실행에 필요한 모든 파일을 export-dist 폴더에 패키징
set -e

EXPORT_DIR=export-dist
IMAGE_NAME=my-project_app:latest
IMAGE_TAR=myapp-amd64.tar

# 1. export-dist 폴더 초기화
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR/data/attendance" "$EXPORT_DIR/data/mongodb"

# 2. .env 생성 (최신화)
./process-env.sh
cp .env "$EXPORT_DIR/.env"

# 3. 도커 이미지 빌드 (amd64)
docker buildx build --platform linux/amd64 -t $IMAGE_NAME .

# 4. 도커 이미지 export
docker save -o "$EXPORT_DIR/$IMAGE_TAR" $IMAGE_NAME

# 5. 데이터 복사
cp -r data/attendance "$EXPORT_DIR/data/"
cp -r data/mongodb "$EXPORT_DIR/data/"

# 6. 배포용 스크립트/설정 복사 (옵션)
cp deployment-config.json5 "$EXPORT_DIR/"
cp process-env.sh "$EXPORT_DIR/"
cp generate-env.js "$EXPORT_DIR/"

# 7. docker-compose.yml 복사 및 app 서비스 build → image 변환
sed '/^\s*build:/,/^\s*container_name:/ {/^\s*build:/d;/^\s*context:/d;/^\s*dockerfile:/d;}' docker-compose.yml | \
sed '/^\s*app:/a\
    image: my-project_app:latest' > "$EXPORT_DIR/docker-compose.yml"

# 8. 안내
cat <<EOF

[패키징 완료]
$EXPORT_DIR 폴더를 서버로 복사해서 아래 순서로 실행하세요:

1. (서버에서) docker load -i $IMAGE_TAR
2. .env, data/attendance, data/mongodb, docker-compose.yml 위치 확인
3. docker compose up -d

EOF
