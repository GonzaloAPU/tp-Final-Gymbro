#!/usr/bin/env python3
"""
Exportador minimo de estado y reinicios de contenedores Docker.

Lee el socket de Docker Engine y expone (en formato Prometheus):
  docker_container_running{id,name}       1 = en ejecucion, 0 = detenido
  docker_container_restart_count{id,name} cantidad real de reinicios del contenedor
  docker_exporter_up                      1

Restriccion del proyecto: no inventar metricas. Estas dos series vienen
directamente de la API de Docker ({{.RestartCount}}).
"""

import json
import http.client
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer

SOCKET = '/var/run/docker.sock'
PORT = 9189


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path, timeout=5):
        super().__init__('localhost', timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.socket_path)


def docker_get(path):
    conn = UnixHTTPConnection(SOCKET, timeout=5)
    conn.request('GET', path)
    resp = conn.getresponse()
    body = resp.read()
    conn.close()
    return json.loads(body)


def esc(s):
    return str(s).replace('\\', '\\\\').replace('"', '\\"')


def build_metrics():
    lines = [
        '# HELP docker_exporter_up The docker stats exporter is up.',
        '# TYPE docker_exporter_up gauge',
        'docker_exporter_up 1',
        '# HELP docker_container_running Container is running (1) or not (0).',
        '# TYPE docker_container_running gauge',
        '# HELP docker_container_restart_count Number of times the container has restarted.',
        '# TYPE docker_container_restart_count counter',
    ]
    containers = docker_get('/containers/json?all=true')
    for c in containers:
        cid = c['Id']
        name = (c.get('Names') or ['?'])[0].lstrip('/')
        inspect = docker_get('/containers/%s/json' % cid)
        state = inspect.get('State', {})
        running = 1 if state.get('Running') else 0
        restarts = inspect.get('RestartCount', 0)
        lines.append(
            'docker_container_running{id="%s",name="%s"} %d' % (esc(cid), esc(name), running)
        )
        lines.append(
            'docker_container_restart_count{id="%s",name="%s"} %d' % (esc(cid), esc(name), restarts)
        )
    return '\n'.join(lines) + '\n'


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path != '/metrics':
            self.send_response(404)
            self.end_headers()
            return
        try:
            body = build_metrics()
        except Exception as exc:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(('error: %s\n' % esc(exc)).encode())
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; version=0.0.4')
        self.end_headers()
        self.wfile.write(body.encode())


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print('docker stats exporter listening on :%d' % PORT)
    server.serve_forever()
