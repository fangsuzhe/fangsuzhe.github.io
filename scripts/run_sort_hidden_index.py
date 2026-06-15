"""启动本地服务器并打开 hiddenIndex 排序助手。"""
from __future__ import annotations

import http.server
import socket
import socketserver
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = "/sort-hidden-index.html"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    port = find_free_port()
    url = f"http://127.0.0.1:{port}{PAGE}"

    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *args, directory=str(ROOT), **kwargs
    )
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"hiddenIndex 排序助手: {url}")
        print("按 Ctrl+C 停止服务")
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")


if __name__ == "__main__":
    main()
