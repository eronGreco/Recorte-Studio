# -*- coding: utf-8 -*-
"""
cameo4_backend.py

Backend CONGELADO para Silhouette CAMEO 4 via USBPRINT nativo do Windows.

Este módulo nasce do fluxo que foi validado fisicamente:
- acesso EXCLUSIVO à interface USBPRINT;
- BULK-IN overlapped permanentemente pendente;
- registration marks em 10 mm;
- AutoBlade no holder 1;
- corte por comandos M/D.

NÃO alterar a sequência de registration sem nova captura USBPcap do Studio.
"""

import ctypes
from ctypes import wintypes
import math
import queue
import subprocess
import sys
import threading
import time

VID = 0x0B4D
PID = 0x1137
USBPRINT_GUID = "{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"

GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000
OPEN_EXISTING = 3
FILE_FLAG_OVERLAPPED = 0x40000000

WAIT_OBJECT_0 = 0x00000000
WAIT_FAILED = 0xFFFFFFFF
INFINITE = 0xFFFFFFFF

ERROR_IO_PENDING = 997
ERROR_OPERATION_ABORTED = 995
ERROR_SHARING_VIOLATION = 32
ERROR_ACCESS_DENIED = 5

INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value

ESC_ENQ = b"\x1b\x05"

STATUS_READY = b"0\x03"
STATUS_MOVING = b"1\x03"
STATUS_UNLOADED = b"2\x03"
REG_OK = b"    0\x03"

# Sequência EXATA validada com marks a 10 mm.
BLOCK1 = b"TG1\x03FN0\x03TB50,0\x03TB99\x03"
BLOCK2 = (
    b"TB52,2\x03"
    b"TB51,200\x03"
    b"TB53,20\x03"
    b"TB55,1\x03"
    b"TB123,3800,5540,118,118\x03"
    b"TB99\x03"
)

REG_X_MM = 10.0
REG_Y_MM = 10.0
REG_WIDTH_MM = 277.0
REG_LENGTH_MM = 190.0


class CameoError(RuntimeError):
    pass


class OVERLAPPED(ctypes.Structure):
    _fields_ = [
        ("Internal", ctypes.c_size_t),
        ("InternalHigh", ctypes.c_size_t),
        ("Offset", wintypes.DWORD),
        ("OffsetHigh", wintypes.DWORD),
        ("hEvent", wintypes.HANDLE),
    ]


def _winerr(err):
    return ctypes.FormatError(err).strip()


def _find_device_path():
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    r = subprocess.run(
        ["pnputil", "/enum-interfaces", "/class", USBPRINT_GUID],
        capture_output=True,
        text=True,
        errors="replace",
        creationflags=creationflags,
    )
    if r.returncode != 0:
        raise CameoError("Não consegui enumerar a interface USBPRINT da Cameo.")

    target = f"VID_{VID:04X}&PID_{PID:04X}"
    for raw in r.stdout.splitlines():
        line = raw.strip()
        if "\\\\?\\" in line and target in line.upper():
            return line[line.find("\\\\?\\"):].strip()

    raise CameoError("CAMEO 4 não encontrada no USBPRINT do Windows.")


def _setup_kernel32():
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)

    k32.CreateFileW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
    ]
    k32.CreateFileW.restype = wintypes.HANDLE

    k32.CreateEventW.argtypes = [
        wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR,
    ]
    k32.CreateEventW.restype = wintypes.HANDLE

    k32.ReadFile.argtypes = [
        wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(OVERLAPPED),
    ]
    k32.ReadFile.restype = wintypes.BOOL

    k32.WriteFile.argtypes = [
        wintypes.HANDLE, wintypes.LPCVOID, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(OVERLAPPED),
    ]
    k32.WriteFile.restype = wintypes.BOOL

    k32.GetOverlappedResult.argtypes = [
        wintypes.HANDLE, ctypes.POINTER(OVERLAPPED),
        ctypes.POINTER(wintypes.DWORD), wintypes.BOOL,
    ]
    k32.GetOverlappedResult.restype = wintypes.BOOL

    k32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    k32.WaitForSingleObject.restype = wintypes.DWORD

    k32.CancelIoEx.argtypes = [wintypes.HANDLE, ctypes.POINTER(OVERLAPPED)]
    k32.CancelIoEx.restype = wintypes.BOOL

    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    k32.CloseHandle.restype = wintypes.BOOL

    return k32


def _make_event(k32):
    ev = k32.CreateEventW(None, True, False, None)
    if not ev:
        err = ctypes.get_last_error()
        raise CameoError(f"CreateEvent falhou: {err} {_winerr(err)}")
    return ev


def _write_exact(k32, handle, data, timeout_ms=5000):
    ev = _make_event(k32)
    ov = OVERLAPPED()
    ov.hEvent = ev
    buf = ctypes.create_string_buffer(data)
    immediate = wintypes.DWORD(0)

    try:
        ctypes.set_last_error(0)
        ok = k32.WriteFile(
            handle, buf, len(data),
            ctypes.byref(immediate), ctypes.byref(ov)
        )

        if ok:
            n = immediate.value
        else:
            err = ctypes.get_last_error()
            if err != ERROR_IO_PENDING:
                raise CameoError(f"WriteFile falhou: {err} {_winerr(err)}")

            rc = k32.WaitForSingleObject(ev, timeout_ms)
            if rc != WAIT_OBJECT_0:
                k32.CancelIoEx(handle, ctypes.byref(ov))
                raise TimeoutError(f"Timeout de escrita ({timeout_ms} ms).")

            transferred = wintypes.DWORD(0)
            if not k32.GetOverlappedResult(
                handle, ctypes.byref(ov), ctypes.byref(transferred), False
            ):
                err = ctypes.get_last_error()
                raise CameoError(
                    f"GetOverlappedResult(write) falhou: {err} {_winerr(err)}"
                )
            n = transferred.value

        if n != len(data):
            raise CameoError(f"Escrita USB incompleta: {n}/{len(data)} bytes.")
    finally:
        k32.CloseHandle(ev)


class PersistentReader:
    """
    Mantém sempre um BULK-IN overlapped pendente.

    Regra congelada:
    NÃO usar timeouts curtos + CancelIoEx durante o registration.
    """

    def __init__(self, k32, handle, size=64):
        self.k32 = k32
        self.handle = handle
        self.size = size
        self.messages = queue.Queue()
        self.stop_event = threading.Event()
        self.armed_event = threading.Event()
        self.lock = threading.Lock()
        self.current_ov = None
        self.thread = threading.Thread(target=self._worker, daemon=True)

    def start(self):
        self.thread.start()
        if not self.armed_event.wait(2.0):
            raise CameoError("Não consegui armar o BULK-IN da Cameo.")

    def wait_armed(self, timeout=2.0):
        if not self.armed_event.wait(timeout):
            raise CameoError("BULK-IN não ficou pendente antes do comando.")

    def get(self, timeout):
        kind, ts, value = self.messages.get(timeout=timeout)
        if kind == "error":
            raise value
        return ts, value

    def stop(self):
        self.stop_event.set()
        with self.lock:
            ov = self.current_ov

        if ov is not None:
            self.k32.CancelIoEx(self.handle, ctypes.byref(ov))

        self.thread.join(timeout=2.0)

    def _worker(self):
        while not self.stop_event.is_set():
            ev = None
            try:
                ev = _make_event(self.k32)
                ov = OVERLAPPED()
                ov.hEvent = ev
                buf = ctypes.create_string_buffer(self.size)
                immediate = wintypes.DWORD(0)

                with self.lock:
                    self.current_ov = ov

                ctypes.set_last_error(0)
                ok = self.k32.ReadFile(
                    self.handle, buf, self.size,
                    ctypes.byref(immediate), ctypes.byref(ov)
                )

                if ok:
                    data = bytes(buf.raw[:immediate.value])
                    if data:
                        self.messages.put(("data", time.monotonic(), data))
                    continue

                err = ctypes.get_last_error()
                if err != ERROR_IO_PENDING:
                    raise CameoError(f"ReadFile falhou: {err} {_winerr(err)}")

                self.armed_event.set()
                rc = self.k32.WaitForSingleObject(ev, INFINITE)
                self.armed_event.clear()

                if rc == WAIT_FAILED:
                    err = ctypes.get_last_error()
                    raise CameoError(
                        f"WaitForSingleObject falhou: {err} {_winerr(err)}"
                    )

                transferred = wintypes.DWORD(0)
                if not self.k32.GetOverlappedResult(
                    self.handle, ctypes.byref(ov),
                    ctypes.byref(transferred), False
                ):
                    err = ctypes.get_last_error()
                    if self.stop_event.is_set() and err == ERROR_OPERATION_ABORTED:
                        return
                    raise CameoError(
                        f"GetOverlappedResult(read) falhou: {err} {_winerr(err)}"
                    )

                data = bytes(buf.raw[:transferred.value])
                if data:
                    self.messages.put(("data", time.monotonic(), data))

            except Exception as e:
                if not self.stop_event.is_set():
                    self.messages.put(("error", time.monotonic(), e))
                return

            finally:
                with self.lock:
                    self.current_ov = None
                if ev:
                    self.k32.CloseHandle(ev)

        self.armed_event.clear()


def _etx(text):
    return text.encode("ascii") + b"\x03"


def _su(mm):
    # 1 Silhouette Unit = 0,05 mm.
    return int(round(mm * 20.0))


def _rounded_rect_points(x, y, w, h, r, arc_steps=8):
    r = max(0.0, min(r, w / 2.0, h / 2.0))
    if r <= 0.0001:
        return [
            (x, y), (x + w, y), (x + w, y + h),
            (x, y + h), (x, y)
        ]

    pts = []

    def arc(cx, cy, a0, a1):
        for i in range(arc_steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / arc_steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    arc(x + w - r, y + r, -90, 0)
    arc(x + w - r, y + h - r, 0, 90)
    arc(x + r, y + h - r, 90, 180)
    arc(x + r, y + r, 180, 270)
    pts.append(pts[0])
    return pts


def _path_bytes(
    page_rect_mm,
    radius_mm,
    overcut_mm=0.0,
    line_overcut=False,
    line_overcut_mm=0.1,
):
    """
    page_rect_mm = (x0,y0,x1,y1) nas coordenadas físicas da página A4.

    Depois do registration, (0,0) lógico da Cameo corresponde à marca TL em
    (10,10) mm. Comandos M/D usam ordem Cameo Y,X.
    """
    x0, y0, x1, y1 = page_rect_mm
    w = x1 - x0
    h = y1 - y0

    x = x0 - REG_X_MM
    y = y0 - REG_Y_MM

    # v1.6v - Sobrecorte de Linha.
    # Em cantos retos (raio 0), cada lado avanca 0,1 mm antes/depois
    # do vertice. Em raio > 0 nao mexemos nos arcos para nao deformar.
    if line_overcut and float(radius_mm) <= 1e-9:
        ext = max(0.0, float(line_overcut_mm))
        corners = [(x,y), (x+w,y), (x+w,y+h), (x,y+h)]
        data = []
        for i in range(4):
            ax, ay = corners[i]
            bx, by = corners[(i+1) % 4]
            vx, vy = bx-ax, by-ay
            length = math.hypot(vx, vy)
            if length <= 1e-9:
                continue
            ux, uy = vx/length, vy/length
            start_ext = ext
            end_ext = ext
            if i == 3:
                # Mantem o sobrecorte no fechamento da 1.5v independente.
                end_ext = max(end_ext, max(0.0, float(overcut_mm)))
            sx, sy = ax-ux*start_ext, ay-uy*start_ext
            ex, ey = bx+ux*end_ext, by+uy*end_ext
            data.append(_etx(f"M{_su(sy)},{_su(sx)}"))
            data.append(_etx(f"D{_su(ey)},{_su(ex)}"))
        return b"".join(data)

    pts = _rounded_rect_points(x, y, w, h, radius_mm)
    first = pts[0]

    data = [_etx(f"M{_su(first[1])},{_su(first[0])}")]
    for px, py in pts[1:]:
        data.append(_etx(f"D{_su(py)},{_su(px)}"))

    # Sobrecorte no FECHAMENTO de um caminho fechado.
    # Depois de voltar ao ponto inicial, percorre novamente o começo do traçado
    # pelo comprimento solicitado. Isso NAO muda cantos nem registration.
    overcut = max(0.0, float(overcut_mm))
    if overcut > 0 and len(pts) >= 3:
        p0 = pts[0]
        p1 = pts[1]
        vx = p1[0] - p0[0]
        vy = p1[1] - p0[1]
        length = math.hypot(vx, vy)
        if length > 1e-9:
            ratio = min(1.0, overcut / length)
            ox = p0[0] + vx * ratio
            oy = p0[1] + vy * ratio
            data.append(_etx(f"D{_su(oy)},{_su(ox)}"))

    return b"".join(data)


class CameoSession:
    """Sessão USB exclusiva. Uma sessão = um trabalho físico."""

    def __init__(self, log=None):
        if sys.platform != "win32":
            raise CameoError("Este backend da CAMEO 4 é somente para Windows.")
        self.log = log or (lambda msg: None)
        self.k32 = None
        self.handle = None
        self.reader = None

    def __enter__(self):
        path = _find_device_path()
        self.k32 = _setup_kernel32()

        ctypes.set_last_error(0)
        self.handle = self.k32.CreateFileW(
            path,
            GENERIC_READ | GENERIC_WRITE,
            0,  # CRÍTICO: acesso EXCLUSIVO.
            None,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,
            None,
        )

        if not self.handle or self.handle == INVALID_HANDLE_VALUE:
            err = ctypes.get_last_error()
            if err in (ERROR_SHARING_VIOLATION, ERROR_ACCESS_DENIED):
                raise CameoError(
                    "A Cameo está sendo usada por outro processo. "
                    "Feche Silhouette Studio, srt_helper e ss_bluetooth."
                )
            raise CameoError(
                f"Não consegui abrir a Cameo: WinError {err}: {_winerr(err)}"
            )

        self.reader = PersistentReader(self.k32, self.handle)
        self.reader.start()
        self.reader.wait_armed()
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.reader is not None:
            self.reader.stop()
        if self.handle:
            self.k32.CloseHandle(self.handle)
        self.reader = None
        self.handle = None

    def _query_ready_initial(self):
        self.reader.wait_armed()
        _write_exact(self.k32, self.handle, ESC_ENQ)

        deadline = time.monotonic() + 5.0
        while time.monotonic() < deadline:
            try:
                _, resp = self.reader.get(
                    timeout=max(0.05, deadline - time.monotonic())
                )
            except queue.Empty:
                break

            self.reader.wait_armed()
            if resp == STATUS_READY:
                return
            if resp == STATUS_MOVING:
                raise CameoError("A Cameo está MOVING antes de iniciar o trabalho.")
            if resp == STATUS_UNLOADED:
                raise CameoError("A Cameo está UNLOADED. Carregue a base.")
            raise CameoError(f"Resposta inesperada no READY inicial: {resp!r}")

        raise CameoError("A Cameo não respondeu READY.")

    def wait_ready(self, timeout=45.0):
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            self.reader.wait_armed()
            _write_exact(self.k32, self.handle, ESC_ENQ)

            try:
                _, resp = self.reader.get(timeout=2.0)
            except queue.Empty:
                continue

            self.reader.wait_armed()

            if resp == STATUS_READY:
                return
            if resp == STATUS_MOVING:
                time.sleep(0.35)
                continue
            if resp == STATUS_UNLOADED:
                raise CameoError("A Cameo ficou UNLOADED.")
            raise CameoError(f"Resposta inesperada de status: {resp!r}")

        raise CameoError("Timeout aguardando a Cameo voltar a READY.")

    def registration(self):
        self.log("Lendo registration marks...")

        self.reader.wait_armed()
        _write_exact(self.k32, self.handle, BLOCK1)

        time.sleep(0.108)
        self.reader.wait_armed()
        _write_exact(self.k32, self.handle, BLOCK2)

        started = time.monotonic()
        next_poll = started + 0.526
        poll_period = 1.015
        deadline = started + 35.0

        while time.monotonic() < deadline:
            now = time.monotonic()

            if now >= next_poll:
                self.reader.wait_armed()
                _write_exact(self.k32, self.handle, ESC_ENQ)
                next_poll += poll_period

            try:
                _, resp = self.reader.get(timeout=0.05)
            except queue.Empty:
                continue

            self.reader.wait_armed()

            if resp == STATUS_MOVING:
                continue

            if resp == REG_OK:
                elapsed = time.monotonic() - started
                self.log(f"Registration OK em {elapsed:.2f}s.")

                self.reader.wait_armed()
                _write_exact(self.k32, self.handle, ESC_ENQ)
                try:
                    _, final = self.reader.get(timeout=5.0)
                except queue.Empty:
                    raise CameoError(
                        "Registration foi aceito, mas não veio READY final."
                    )
                self.reader.wait_armed()

                if final != STATUS_READY:
                    raise CameoError(
                        f"Registration OK, mas resposta final foi {final!r}."
                    )
                return

            stripped = resp.rstrip(b"\x03").strip()
            if stripped.startswith(b"-"):
                raise CameoError(f"Falha ao ler registration marks: {resp!r}")

            # Em acesso exclusivo, nada desconhecido deve ser ignorado.
            raise CameoError(
                f"Resposta inesperada durante registration: {resp!r}"
            )

        raise CameoError("Timeout de 35s na leitura das registration marks.")

    def configure_autoblade(self, depth, pressure, speed):
        self.log(
            f"Configurando AutoBlade: profundidade {depth}, "
            f"força {pressure}, velocidade {speed}."
        )

        setup = b"".join([
            _etx("\\0,0"),
            _etx("Z3800,5540"),
            _etx("J1"),
            _etx(f"FX{pressure},1"),
            _etx("TJ0"),
            _etx(f"!{speed},1"),
            _etx("FC0,1,1"),
            _etx("FE0,1"),
            _etx("FF1,0,1"),
            _etx("FF1,1,1"),
            _etx(f"FX{pressure},1"),
            _etx("TJ3"),
            _etx("FC18,1,1"),
            _etx(f"TF{depth},1"),
        ])

        _write_exact(self.k32, self.handle, setup)
        self.wait_ready(timeout=15.0)

    def cut_rect(
        self, page_rect_mm, radius_mm, passes=1, overcut_mm=0.0,
        line_overcut=False
    ):
        data = _path_bytes(
            page_rect_mm, radius_mm, overcut_mm=overcut_mm,
            line_overcut=line_overcut, line_overcut_mm=0.1
        )
        for p in range(passes):
            _write_exact(self.k32, self.handle, data, timeout_ms=5000)
            self.wait_ready(timeout=45.0)
            if passes > 1:
                self.log(f"Passada {p + 1}/{passes} concluída.")

    def home(self):
        _write_exact(self.k32, self.handle, _etx("M0,0"))
        self.wait_ready(timeout=10.0)


def test_connection(log=None):
    log = log or (lambda msg: None)
    with CameoSession(log=log) as s:
        s._query_ready_initial()
        log("Cameo conectada e READY.")


def read_marks_only(log=None):
    log = log or (lambda msg: None)
    with CameoSession(log=log) as s:
        s._query_ready_initial()
        s.registration()
        log("Marcas lidas com sucesso.")


def cut_job(card_rects_mm, depth=4, pressure=18, speed=2,
            passes=1, radius_mm=3.0, overcut_mm=0.0,
            line_overcut=False, log=None):
    """
    Executa UM trabalho físico:
      READY -> registration -> AutoBlade -> cartões selecionados -> home.

    card_rects_mm: lista de (x0,y0,x1,y1) na página física.
    """
    log = log or (lambda msg: None)

    if not card_rects_mm:
        raise CameoError("Nenhuma carta selecionada.")

    with CameoSession(log=log) as s:
        s._query_ready_initial()
        log("Cameo READY.")
        s.registration()
        s.configure_autoblade(depth, pressure, speed)

        if line_overcut:
            if float(radius_mm) <= 1e-9:
                log("Sobrecorte de Linha ATIVO: 0,1 mm nos cantos retos.")
            else:
                log(
                    "Sobrecorte de Linha ATIVO, mas o raio e maior que zero; "
                    "cantos arredondados preservados sem sobrecorte de segmento."
                )

        total = len(card_rects_mm)
        for i, rect in enumerate(card_rects_mm, start=1):
            x0, y0, x1, y1 = rect
            log(
                f"Cortando {i}/{total}: "
                f"{x1-x0:.2f} x {y1-y0:.2f} mm "
                f"em x={x0:.2f}, y={y0:.2f}."
            )
            s.cut_rect(
                rect, radius_mm, passes=passes,
                overcut_mm=overcut_mm, line_overcut=line_overcut
            )

        s.home()
        log("Corte concluído. Cameo READY.")
