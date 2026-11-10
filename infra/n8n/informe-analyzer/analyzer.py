#!/usr/bin/env python3
"""
Analizador de rendimiento asistido por IA (heuristica, sin dependencias).

Recibe un JSON con metricas consolidadas de Prometheus y devuelve:
  {
    "anomalies": [ { "metric": "...", "value": ..., "detail": "..." } ],
    "riskLevel": "OK" | "WARN" | "CRIT",
    "summary": "texto legible"
  }

Disenado para correr sin instalar nada (stdlib puro) para que el TP sea
reproducible en cualquier maquina del equipo.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

# Umbrales heuristicos (ajustables en caliente sin tocar el resto)
THRESHOLDS = {
    "probe_duration_seconds_warn": 0.5,   # backend probe lento (>500 ms)
    "probe_duration_seconds_crit": 2.0,   # (>2 s)
    "restart_count_warn": 1,
    "memory_available_warn_bytes": 512 * 1024 * 1024,  # 512 MB
    "memory_available_crit_bytes": 256 * 1024 * 1024,  # 256 MB
}

def evaluate(metrics: dict):
    anomalies = []
    def add(metric, value, detail):
        anomalies.append({"metric": metric, "value": value, "detail": detail})

    # 1) Backend no responde
    if metrics.get("backend_up") is False:
        add("backend_up", 0, "El backend no responde a la sonda HTTP (probe_success == 0)")

    # 2) Latencia del backend
    dur = metrics.get("backend_probe_duration_seconds")
    if dur is not None:
        if dur > THRESHOLDS["probe_duration_seconds_crit"]:
            add("backend_probe_duration_seconds", dur, f"Latencia critica {dur:.2f}s")
        elif dur > THRESHOLDS["probe_duration_seconds_warn"]:
            add("backend_probe_duration_seconds", dur, f"Latencia alta {dur:.2f}s")

    # 3) Restarts de contenedores
    restarts = metrics.get("docker_container_restart_count_total")
    if restarts is not None and restarts > THRESHOLDS["restart_count_warn"]:
        add("docker_container_restart_count_total", restarts, f"Se detectaron {restarts} reinicios de contenedor")

    # 4) Memoria disponible
    mem = metrics.get("node_memory_MemAvailable_bytes")
    if mem is not None:
        if mem < THRESHOLDS["memory_available_crit_bytes"]:
            add("node_memory_MemAvailable_bytes", mem, f"Memoria disponible critica: {mem // (1024*1024)} MB")
        elif mem < THRESHOLDS["memory_available_warn_bytes"]:
            add("node_memory_MemAvailable_bytes", mem, f"Memoria disponible baja: {mem // (1024*1024)} MB")

    # 5) Reglas simples de ausencia/valor inesperado
    if metrics.get("backend_up") is None:
        add("backend_up", None, "No se pudo leer el estado del backend desde Prometheus")

    # Resultado global
    severity = "OK"
    if any(a["metric"] == "backend_up" and a["value"] == 0 for a in anomalies):
        severity = "CRIT"
    elif anomalies:
        severity = "WARN" if not any("crit" in a["detail"].lower() for a in anomalies) else "CRIT"

    parts = [a["detail"] for a in anomalies]
    if not parts:
        summary = "No se detectaron anomalias; el estado del servicio esta dentro de los umbrales definidos."
    else:
        summary = "Detectadas " + str(len(parts)) + " anomalia(s): " + "; ".join(parts) + "."

    return {
        "anomalies": anomalies,
        "riskLevel": severity,
        "summary": summary,
        "metrics": metrics,
    }

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/analyze":
            self._send_json(404, {"error": "not found"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"error": "JSON inválido"})
            return
        metrics = payload.get("metrics") or payload or {}
        if not isinstance(metrics, dict):
            self._send_json(400, {"error": "`metrics` debe ser un objeto"})
            return
        result = evaluate(metrics)
        self._send_json(200, result)

    def log_message(self, format, *args):
        # Log compacto para no llenar el output de n8n
        sys.stderr.write("[analyzer] " + (format % args) + "\n")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
