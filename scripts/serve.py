#!/usr/bin/env python3
"""Serve local project assets. Binds only to this computer; never opens a LAN listener."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import argparse
import errno
import webbrowser
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='肌薄本地服务，仅允许本机访问。')
parser.add_argument('--port',type=int,default=8766,help='端口（默认 8766；0 为临时端口，仅供测试）')
parser.add_argument('--no-open',action='store_true')
args=parser.parse_args()
if not 0<=args.port<=65535:
    parser.error('--port 必须在 0 到 65535 之间')
handler=partial(SimpleHTTPRequestHandler,directory=str(ROOT/'web'))
try:
    server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
except OSError as exc:
    detail=f'肌薄无法使用端口 {args.port}：{exc}'
    if exc.errno==errno.EADDRINUSE:
        detail+=f'\n若已启动肌薄，请打开 http://127.0.0.1:{args.port}/ 。\n也可指定 --port 8767；浏览器记录与端口绑定，更换端口前请先导出备份。'
    raise SystemExit(detail)
url=f'http://127.0.0.1:{server.server_port}/'
print(f'肌薄：{url}\n仅本机可访问。保留此窗口，按 Ctrl+C 停止服务。',flush=True)
if args.port==0:
    print('当前使用临时端口，适合测试。长期记录请使用默认固定端口 8766。',flush=True)
if not args.no_open:webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
