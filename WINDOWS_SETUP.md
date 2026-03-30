# Windows에서 mirinae-근태관리 실행법

1. WSL(권장) 또는 Git Bash, PowerShell 설치
   - WSL: https://learn.microsoft.com/ko-kr/windows/wsl/install

2. Node.js 18+ 설치
   - https://nodejs.org/ko/download/

3. pnpm 설치
   - npm install -g pnpm

4. MongoDB 설치 (로컬 또는 Docker)
   - https://www.mongodb.com/try/download/community
   - 또는 Docker Desktop 설치 후:
     docker compose up -d mongodb

5. 저장소 복사
   - git clone <이 저장소 주소>
   - 또는 zip 파일로 복사 후 압축 해제

6. 환경변수(.env) 설정
   - .env 파일을 Windows 경로에 맞게 수정 (예: ATTENDANCE_ARCHIVE_DIR=C:/mirinae-attendance)

7. 의존성 설치
   - pnpm install

8. 개발 서버 실행
   - pnpm dev

9. 브라우저에서 접속
   - http://localhost:3000

10. 출근/퇴근 테스트 후, 아카이브 폴더(C:/mirinae-attendance/2026/)에 파일 생성 확인

---

## 참고

- WSL 사용 시 Linux 경로(/tmp 등) 대신 Windows 경로(C:/...)로 바꿔야 파일 접근이 쉬움
- 포트 포워딩/방화벽 해제 필요 시 Windows Defender에서 3000 포트 허용
- Docker Desktop은 WSL2 백엔드 권장

---

# Windows에서 Docker로 실행하기

1. Docker Desktop 설치
   - https://www.docker.com/products/docker-desktop/

2. (최초 1회) 프로젝트 루트에 .env 파일 준비
   - 예시:
     ```env
     MONGODB_URI=mongodb://mongodb:27017
     MONGODB_DB=mirinae_attendance
     ATTENDANCE_ARCHIVE_DIR=/data/attendance
     # 기타 기존 환경변수 그대로 복사
     ```

3. docker-compose.yml 예시 (이미 있음)
   - 볼륨 마운트 추가:
     ```yaml
     services:
       app:
         build: .
         ports:
           - "3000:3000"
         volumes:
           - ./data/attendance:/data/attendance # 아카이브 파일을 호스트와 공유
         env_file:
           - .env
         depends_on:
           - mongodb
       mongodb:
         image: mongo:6
         ports:
           - "27017:27017"
         volumes:
           - ./data/mongodb:/data/db
     ```
   - (data/attendance, data/mongodb 폴더는 자동 생성됨)

4. Dockerfile 예시 (이미 있음)
   - Node 18+ 기반, pnpm, next 빌드 포함

5. 빌드 및 실행

   ```bash
   docker compose up --build -d
   ```

6. 접속
   - http://localhost:3000
   - 아카이브 파일: 프로젝트/data/attendance/2026/attendance_2026-03.xlsx

7. 파일을 Windows에서 바로 열고 싶으면 data/attendance 폴더를 탐색기로 열면 됨

---

## 참고

- .env의 ATTENDANCE_ARCHIVE_DIR는 컨테이너 내부 경로(/data/attendance)로 지정
- 호스트(Windows)와 공유하려면 docker-compose.yml의 volumes로 매핑
- MongoDB 데이터도 동일하게 ./data/mongodb:/data/db로 백업 가능
- Docker Desktop에서 컨테이너/볼륨 관리 가능
- 포트 충돌 시 3000, 27017 포트 변경 가능
