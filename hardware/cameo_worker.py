"""JSON-lines bridge to the user's preserved USBPRINT backend (standard library only)."""
import ctypes
import contextlib
from ctypes import wintypes
import json
import os
import queue
import re
import sys
import time
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import registration_parameters as registration

sys.path.insert(0, str(Path(__file__).parent / "vendor"))
import cameo4_backend as original


def emit(**data):
    print(json.dumps(data, ensure_ascii=True), flush=True)


class JobControl:
    """Host-side control only. Never guesses device pause/reset opcodes."""
    def __init__(self):
        self.commands = queue.Queue()

    def receive(self, stream):
        while True:
            line = stream.readline(1025)
            if not line:
                return
            try:
                value = json.loads(line)
                if set(value) == {'control'} and value['control'] in ('pause', 'resume', 'stop'):
                    self.commands.put(value['control'])
            except (ValueError, TypeError):
                pass

    def checkpoint(self, session, settings, done, total):
        command = None
        while True:
            try:
                value = self.commands.get_nowait()
                if value == 'stop':
                    return True
                if value == 'pause':
                    command = value
            except queue.Empty:
                break
        if command != 'pause':
            return False
        emit(kind='state', state='paused', message='Pausado após a última passada concluída. Mantenha esta folha na base.', completed=done, total=total, pauseRequested=False, stopRequested=False)
        while True:
            value = self.commands.get()
            if value == 'stop':
                return True
            if value == 'resume':
                # Both origin and tool are restored from the immutable job, never the editor.
                emit(kind='state', state='registering', message='Relendo as marcas antes de continuar…', completed=done, total=total, pauseRequested=False, stopRequested=False)
                session._query_ready_initial()
                session.registration()
                session.configure_autoblade(settings['depth'], settings['force'], settings['speed'])
                return False


class InputLines:
    """Unbuffered pipe reads: no buffered stdin lock held by a daemon at exit."""
    def __init__(self, fd):
        self.fd, self.buffer = fd, b''

    def readline(self, limit):
        while b'\n' not in self.buffer and len(self.buffer) < limit:
            chunk = os.read(self.fd, min(4096, limit - len(self.buffer)))
            if not chunk:
                line, self.buffer = self.buffer, b''
                return line
            self.buffer += chunk
        end = self.buffer.find(b'\n') + 1
        size = min(limit, end if end else len(self.buffer))
        line, self.buffer = self.buffer[:size], self.buffer[size:]
        return line


def stop_at_checkpoint(session, control, settings, done, total):
    if control and control.checkpoint(session, settings, done, total):
        session.home()
        return {'state':'stopped', 'message':f'Envio encerrado após {done} de {total} passadas. Os trajetos restantes não foram enviados.', 'completed':done, 'total':total, 'pauseRequested':False, 'stopRequested':False}
    return None


class FramedReader:
    """USB transfers may split/coalesce messages. Spaces preceding REG_OK matter."""
    def __init__(self, reader):
        self.reader, self.buffer = reader, b""

    def wait_armed(self, timeout=2.0):
        return self.reader.wait_armed(timeout)

    def stop(self):
        return self.reader.stop()

    def get(self, timeout):
        deadline = time.monotonic() + timeout
        while b"\x03" not in self.buffer:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise queue.Empty()
            _, data = self.reader.get(remaining)
            self.buffer += data
            if len(self.buffer) > 4096:
                raise original.CameoError("Resposta USB maior que o esperado.")
        frame, self.buffer = self.buffer.split(b"\x03", 1)
        return time.monotonic(), frame + b"\x03"


def normalize_status_frame(frame):
    """Accept observed status padding without treating registration ACK as READY."""
    # Four leading spaces identify REG_OK in the preserved USB capture/backend.
    # Never strip arbitrary whitespace: malformed/unknown frames must still fail.
    match = re.fullmatch(rb" {0,3}([0-4])\x03", frame)
    return match.group(1) + b"\x03" if match else frame


class StatusReader:
    def __init__(self, reader):
        self.reader = reader

    def wait_armed(self, timeout=2.0):
        return self.reader.wait_armed(timeout)

    def get(self, timeout):
        timestamp, frame = self.reader.get(timeout)
        return timestamp, normalize_status_frame(frame)


# Keep an outstanding WriteFile's buffer and OVERLAPPED alive until completion,
# including after CancelIoEx. Do not change any protocol bytes or registration timing.
_outstanding = []


def write_exact(k32, handle, data, timeout_ms=5000):
    ev = original._make_event(k32)
    ov = original.OVERLAPPED()
    ov.hEvent = ev
    buf = ctypes.create_string_buffer(data)
    immediate = wintypes.DWORD(0)
    completed = False
    try:
        ctypes.set_last_error(0)
        ok = k32.WriteFile(handle, buf, len(data), ctypes.byref(immediate), ctypes.byref(ov))
        if ok:
            completed = True
            n = immediate.value
        else:
            err = ctypes.get_last_error()
            if err != original.ERROR_IO_PENDING:
                completed = True
                raise original.CameoError(f"Falha de escrita USB: {err} {original._winerr(err)}")
            rc = k32.WaitForSingleObject(ev, timeout_ms)
            if rc != original.WAIT_OBJECT_0:
                k32.CancelIoEx(handle, ctypes.byref(ov))
                if k32.WaitForSingleObject(ev, 2000) == original.WAIT_OBJECT_0:
                    transferred = wintypes.DWORD(0)
                    k32.GetOverlappedResult(handle, ctypes.byref(ov), ctypes.byref(transferred), False)
                    completed = True
                raise TimeoutError("A CAMEO não confirmou a escrita USB. O corte pode estar incompleto.")
            transferred = wintypes.DWORD(0)
            completed = True
            if not k32.GetOverlappedResult(handle, ctypes.byref(ov), ctypes.byref(transferred), False):
                err = ctypes.get_last_error()
                raise original.CameoError(f"Falha na confirmação USB: {err} {original._winerr(err)}")
            n = transferred.value
        if n != len(data):
            raise original.CameoError(f"Escrita USB incompleta: {n}/{len(data)} bytes.")
    finally:
        if completed:
            k32.CloseHandle(ev)
        else:
            _outstanding.append((buf, ov, ev))


original._write_exact = write_exact


# A long OVERLAPPED write may already be executing partly when its 5s write
# deadline expires. Bound motion batches and drain each one with READY, instead
# of sending the whole contour or retrying an uncertain write.
PATH_BLOCK_BYTES = 1024


def path_blocks(body, max_bytes=PATH_BLOCK_BYTES):
    if not isinstance(body, bytes) or not body or not body.endswith(b'\x03'):
        raise ValueError('Trajeto sem terminador de comando.')
    if type(max_bytes) is not int or not 1 <= max_bytes <= PATH_BLOCK_BYTES:
        raise ValueError('Tamanho de bloco USB inválido.')
    blocks, pending = [], bytearray()
    for value in body.split(b'\x03')[:-1]:
        if not value:
            raise ValueError('Comando vazio no trajeto.')
        command = value + b'\x03'
        if len(command) > max_bytes:
            raise ValueError('Um comando ultrapassa o limite do bloco USB.')
        if len(pending) + len(command) > max_bytes:
            blocks.append(bytes(pending))
            pending.clear()
        pending.extend(command)
    if pending:
        blocks.append(bytes(pending))
    return blocks


def send_path(session, path, pass_number):
    body = path['body'].encode('ascii')
    blocks = path_blocks(body)
    confirmed = 0
    for index, block in enumerate(blocks, 1):
        detail = dict(pathId=path['id'], passNumber=pass_number,
                      block=index, blocks=len(blocks), blockBytes=len(block),
                      pathBytes=len(body), confirmedBytes=confirmed)
        emit(kind='log', phase='path-block-send',
             message=f'Enviando trecho {index}/{len(blocks)} do contorno · passada {pass_number}.', **detail)
        try:
            write_exact(session.k32, session.handle, block)
            session.wait_ready(timeout=180.0)
        except Exception as error:
            emit(kind='log', phase='path-block-failed',
                 message='Envio interrompido; o trecho não foi repetido.', **detail)
            raise original.CameoError(
                f'Falha no trecho {index}/{len(blocks)} do contorno, passada {pass_number}. '
                f'{error} O trecho pode ter sido cortado parcialmente e não foi reenviado.'
            ) from error
        confirmed += len(block)
        emit(kind='log', phase='path-block-ready',
             message=f'Trecho {index}/{len(blocks)} concluído pela CAMEO.',
             **{**detail, 'confirmedBytes': confirmed})


class Session(original.CameoSession):
    @contextlib.contextmanager
    def status_reader(self):
        previous = self.reader
        self.reader = StatusReader(previous)
        try:
            yield
        finally:
            self.reader = previous

    def _query_ready_initial(self):
        with self.status_reader():
            return super()._query_ready_initial()

    def wait_ready(self, timeout=45.0):
        with self.status_reader():
            return super().wait_ready(timeout)

    def registration(self):
        # Each worker owns one session; the frozen module is never edited on disk.
        previous = original.BLOCK2
        try:
            original.BLOCK2 = registration.block2(self.registration_params)
            with self.status_reader():
                return super().registration()
        finally:
            original.BLOCK2 = previous

    def configure_autoblade(self, depth, pressure, speed):
        self.log(f"Configurando AutoBlade: profundidade {depth}, força {pressure}, velocidade {speed}.")
        write_exact(self.k32, self.handle, registration.blade_setup(self.registration_params, depth, pressure, speed))
        self.wait_ready(timeout=15.0)

    def __enter__(self):
        try:
            super().__enter__()
            self.reader = FramedReader(self.reader)
            return self
        except Exception:
            if self.handle == original.INVALID_HANDLE_VALUE:
                self.handle = None
            self.__exit__(*sys.exc_info())
            raise


def validate_tool_settings(settings):
    bounds = {"depth": (1, 10), "force": (1, 33), "speed": (1, 10), "passes": (1, 5)}
    if not isinstance(settings, dict) or set(settings) != set(bounds):
        raise ValueError("Ajustes de ferramenta inválidos.")
    for key, (lo, hi) in bounds.items():
        if type(settings[key]) is not int or not lo <= settings[key] <= hi:
            raise ValueError("Ajuste de ferramenta fora do limite: " + key)
    return settings


def validate_job(job):
    if not isinstance(job, dict) or set(job) - {"settings", "paths", "registration"} or not {"settings", "paths"} <= set(job):
        raise ValueError("Trabalho USB inválido.")
    layout = registration.normalize(job.get('registration'))
    height_su, width_su = registration.area_su(layout)
    settings = validate_tool_settings(job["settings"])
    paths = job["paths"]
    if not isinstance(paths, list) or not 1 <= len(paths) <= 200:
        raise ValueError("Quantidade de trajetos inválida.")
    size = 0
    for path in paths:
        if not isinstance(path, dict) or set(path) != {"id", "body"} or not isinstance(path["id"], str):
            raise ValueError("Trajeto inválido.")
        body = path["body"]
        if not isinstance(body, str) or not re.fullmatch(r"(?:M\d+,\d+\x03(?:D\d+,\d+\x03)+)+", body):
            raise ValueError("Comando fora do contrato de contornos.")
        for y, x in re.findall(r"[MD](\d+),(\d+)\x03", body):
            if not 0 <= int(y) <= height_su or not 0 <= int(x) <= width_su:
                raise ValueError("Trajeto fora da área útil da CAMEO.")
        size += len(body) * settings["passes"]
    if size > 1000000:
        raise ValueError("Trabalho USB grande demais.")
    return settings, paths


def validate_calibration(job):
    if not isinstance(job, dict) or set(job) != {'registration', 'trials'}:
        raise ValueError('Rodada de calibração inválida.')
    trials = job['trials']
    if not isinstance(trials, list) or len(trials) != 6:
        raise ValueError('A calibração deve conter seis testes.')
    for index, trial in enumerate(trials):
        if not isinstance(trial, dict) or set(trial) != {'label', 'settings', 'paths'} or trial['label'] != 'ABCDEF'[index]:
            raise ValueError('Identificação dos testes inválida.')
        validate_job({'registration': job['registration'], 'settings': trial['settings'], 'paths': trial['paths']})
        if len(trial['paths']) != 1 or trial['paths'][0]['id'] != 'calibration-' + trial['label']:
            raise ValueError('A calibração só pode enviar os contornos dos testes.')
    return trials


def run(action, job=None, session_factory=Session, control=None):
    if action not in ("status", "register", "cut", "calibrate", "adjust-blade"):
        raise ValueError("Ação não reconhecida.")
    if action == "cut":
        settings, paths = validate_job(job)
    if action == 'calibrate':
        trials = validate_calibration(job)
    if action == 'adjust-blade':
        if not isinstance(job, dict) or set(job) != {'settings', 'registration'}:
            raise ValueError('Pedido de ajuste da lâmina inválido.')
        settings = validate_tool_settings(job['settings'])
        registration.normalize(job['registration'])
    emit(kind="state", state="connecting", message="Conectando à CAMEO 4…")
    session = session_factory(log=lambda msg: emit(kind="log", message=msg))
    session.registration_params = registration.normalize(job.get('registration') if job else None)
    with session:
        if action == "status":
            session.reader.wait_armed()
            write_exact(session.k32, session.handle, original.ESC_ENQ)
            try:
                _, response = session.reader.get(5.0)
                response = normalize_status_frame(response)
            except queue.Empty:
                raise original.CameoError("CAMEO encontrada, mas sem resposta de status. Confira energia e cabo USB.")
            states = {original.STATUS_READY: ("ready", "CAMEO 4 conectada · base carregada"),
                      original.STATUS_UNLOADED: ("unloaded", "CAMEO 4 conectada · carregue a base"),
                      original.STATUS_MOVING: ("moving", "CAMEO 4 conectada · em movimento")}
            if response not in states:
                raise original.CameoError(f"Resposta de status não reconhecida: {response!r}")
            state, message = states[response]
            return {"state": state, "message": message}
        session._query_ready_initial()
        if action == 'adjust-blade':
            emit(kind='state', state='configuring', message='Pedindo profundidade 0. Observe o indicador vermelho…')
            session.configure_autoblade(0, settings['force'], settings['speed'])
            emit(kind='state', state='configuring', message=f"Pedindo profundidade {settings['depth']}. Observe o indicador vermelho…")
            session.configure_autoblade(settings['depth'], settings['force'], settings['speed'])
            return {'state':'ready', 'message':f"Ajuste solicitado para {settings['depth']}. Confira o indicador vermelho: READY não mede a profundidade física. Nenhum contorno foi enviado."}
        emit(kind="state", state="registering", message="Lendo as três marcas da folha…")
        session.registration()
        if action == "register":
            return {"state": "registered", "message": "As três marcas foram lidas. A CAMEO confirmou que está pronta."}
        if action == 'calibrate':
            total = sum(t['settings']['passes'] for t in trials)
            done = 0
            for trial in trials:
                s = trial['settings']
                emit(kind='state', state='configuring', message='Ajustando a AutoBlade para o teste ' + trial['label'] + '…', completed=done, total=total)
                session.configure_autoblade(s['depth'], s['force'], s['speed'])
                for repeat in range(s['passes']):
                    stopped = stop_at_checkpoint(session, control, s, done, total)
                    if stopped:
                        return stopped
                    emit(kind='state', state='cutting', message=f"Teste {trial['label']} · passada {repeat + 1} de {s['passes']}…", completed=done, total=total)
                    send_path(session, trial['paths'][0], repeat + 1)
                    done += 1
                    emit(kind='state', state='cutting', message=f"Teste {trial['label']} · passada concluída.", completed=done, total=total)
            session.home()
            return {'state': 'completed', 'message': 'Seis testes concluídos. Retire a folha e compare A a F com a prévia.', 'completed': done, 'total': total}
        emit(kind="state", state="configuring", message="Ajustando a AutoBlade no suporte 1…")
        session.configure_autoblade(settings["depth"], settings["force"], settings["speed"])
        total = len(paths) * settings["passes"]
        done = 0
        for path in paths:
            for repeat in range(settings["passes"]):
                stopped = stop_at_checkpoint(session, control, settings, done, total)
                if stopped:
                    return stopped
                emit(kind="state", state="cutting", message=f"Cortando contorno {done + 1} de {total}…", completed=done, total=total)
                send_path(session, path, repeat + 1)
                done += 1
                emit(kind='state', state='cutting', message=f"{done} de {total} passadas concluídas.", completed=done, total=total)
        emit(kind="state", state="homing", message="Finalizando o trabalho…", completed=done, total=total)
        session.home()
        return {"state": "completed", "message": "Corte concluído. A CAMEO confirmou que está pronta.", "completed": done, "total": total}


if __name__ == "__main__":
    try:
        input_lines = InputLines(sys.stdin.fileno())
        line = input_lines.readline(2000001)
        if len(line) > 2000000:
            raise ValueError("Pedido grande demais.")
        request = json.loads(line)
        if not isinstance(request, dict) or set(request) - {"action", "job"}:
            raise ValueError("Pedido inválido.")
        control = JobControl() if request.get('action') in ('cut','calibrate') else None
        if control:
            threading.Thread(target=control.receive, args=(input_lines,), daemon=True).start()
        result = run(request.get("action"), request.get("job"), control=control)
        emit(kind="result", **result)
    except Exception as error:
        detail = str(error)
        message = detail
        if "outro processo" in message:
            message = "A CAMEO está em uso. Feche o Silhouette Studio e outros aplicativos de corte e tente novamente."
        elif "UNLOADED" in message:
            message = "A base não está carregada na CAMEO. Carregue a base e tente novamente."
        elif "MOVING antes" in message:
            message = "A CAMEO já está em movimento. Aguarde terminar antes de iniciar outro trabalho."
        elif "Falha ao ler registration" in message or "Timeout de 35s" in message:
            message = "A CAMEO não conseguiu ler as marcas. Confira a orientação da folha, a impressão em 100% e sua posição na base."
        elif any(term in message for term in ("ReadFile", "GetOverlappedResult", "WaitForSingleObject", "Falha de escrita USB")):
            message = "A comunicação USB foi interrompida. Confira o cabo e a alimentação da CAMEO."
        emit(kind="error", state="error", message=message, detail=detail)
        sys.exit(1)
