// deployment-config.json5 → .env 변환 스크립트
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");

const configPath = path.join(__dirname, "deployment-config.json5");
const envPath = path.join(__dirname, ".env");

const config = JSON5.parse(fs.readFileSync(configPath, "utf8"));

const lines = Object.entries(config)
  .filter(
    ([k, v]) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  )
  .map(([k, v]) => `${k}=${String(v)}`);

fs.writeFileSync(envPath, lines.join("\n") + "\n");
console.log(".env 파일이 성공적으로 생성되었습니다.");
