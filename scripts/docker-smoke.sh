#!/bin/sh
set -eu

base_url="${CHARACTER_ARCHITECT_URL:-http://127.0.0.1:8765}"

card_total() {
  curl --fail --silent --show-error "${base_url}/api/cards?page=1&limit=1" |
    node -e "let data='';process.stdin.on('data',chunk=>data+=chunk);process.stdin.on('end',()=>{const value=JSON.parse(data).total;if(typeof value!=='number')process.exit(1);process.stdout.write(String(value))})"
}

docker compose up --detach --build --wait
curl --fail --silent --show-error "${base_url}/health" >/dev/null
curl --fail --silent --show-error "${base_url}/" | grep -q '<div id="root"></div>'
docker compose exec -T api ffmpeg -v error -f lavfi -i color=c=black:s=16x16:d=0.1 -frames:v 1 -f null -
before_restart="$(card_total)"

docker compose restart
docker compose up --detach --wait
curl --fail --silent --show-error "${base_url}/health" >/dev/null
after_restart="$(card_total)"

if [ "${before_restart}" != "${after_restart}" ]; then
  echo "Persistence check failed: card count changed from ${before_restart} to ${after_restart}" >&2
  exit 1
fi

echo "Docker smoke test passed: health endpoint is ready and ${after_restart} cards survived restart."
