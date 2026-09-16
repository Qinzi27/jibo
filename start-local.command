#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' '肌薄需要 Python 3 启动本地服务。' '也可以直接打开 dist/jibo-offline.html 使用离线版。'
  read -r -p '按回车关闭窗口…' _jibo_reply
  exit 1
fi
if ! python3 scripts/serve.py "$@"; then
  read -r -p '启动未完成，按回车关闭窗口…' _jibo_reply
  exit 1
fi
