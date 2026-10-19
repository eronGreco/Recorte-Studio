import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import contextlib
import io
import queue
import unittest
from unittest.mock import patch
import cameo_worker as worker
import registration_parameters as registration


class Reader:
    def __init__(self, chunks):
        self.chunks = iter(chunks)
    def get(self, timeout):
        try:
            return 0, next(self.chunks)
        except StopIteration:
            raise queue.Empty()
    def wait_armed(self, timeout=2):
        pass


class Session:
    def __init__(self, log):
        self.events = []
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.events.append('close')
    def _query_ready_initial(self):
        self.events.append('ready')
    def registration(self):
        self.events.append('register')
    def configure_autoblade(self, *args):
        self.events.append(('blade', args))
    def wait_ready(self, timeout):
        self.events.append('wait')
    def home(self):
        self.events.append('home')
    k32 = None
    handle = None


class Tests(unittest.TestCase):
    def test_pause_rescans_and_continues_next_pass_without_repeating_completed(self):
        control = worker.JobControl()
        s = Session(None)
        events = []
        def wait(timeout):
            s.events.append('wait')
            if s.events.count('wait') == 1:
                control.commands.put('pause')
        s.wait_ready = wait
        def event(**data):
            events.append(data)
            if data.get('state') == 'paused':
                control.commands.put('resume')
        job = {'settings':{'depth':4,'force':21,'speed':2,'passes':2},'paths':[{'id':'a','body':'M400,400\x03D600,600\x03'},{'id':'b','body':'M800,800\x03D900,900\x03'}]}
        with patch.object(worker,'emit',side_effect=event),patch.object(worker,'write_exact',side_effect=lambda k,h,d:s.events.append(d)):
            result = worker.run('cut',job,session_factory=lambda **kw:s,control=control)
        self.assertEqual([e for e in s.events if isinstance(e,bytes)],[p['body'].encode() for p in job['paths'] for _ in range(2)])
        self.assertEqual(s.events.count('register'),2)
        self.assertEqual(s.events.count(('blade',(4,21,2))),2)
        self.assertEqual(next(e for e in events if e.get('state')=='paused')['completed'],1)
        self.assertEqual(result['completed'],4)

    def test_stop_finishes_current_pass_and_never_sends_remaining(self):
        for pause in (False,True):
            control = worker.JobControl()
            s = Session(None)
            def wait(timeout):
                s.events.append('wait')
                control.commands.put('pause' if pause else 'stop')
            s.wait_ready = wait
            def event(**data):
                if data.get('state') == 'paused':
                    control.commands.put('stop')
            job = {'settings':{'depth':4,'force':21,'speed':2,'passes':2},'paths':[{'id':'a','body':'M400,400\x03D600,600\x03'}]}
            with patch.object(worker,'emit',side_effect=event),patch.object(worker,'write_exact',side_effect=lambda k,h,d:s.events.append(d)):
                result = worker.run('cut',job,session_factory=lambda **kw:s,control=control)
            self.assertEqual(result['state'],'stopped')
            self.assertEqual(result['completed'],1)
            self.assertEqual(len([e for e in s.events if isinstance(e,bytes)]),1)
            self.assertEqual(s.events.count('home'),1)
            self.assertEqual(s.events.count('register'),1)

    def test_resume_scan_failure_never_sends_next_pass(self):
        control = worker.JobControl()
        s = Session(None)
        s.wait_ready = lambda timeout: control.commands.put('pause')
        def scan():
            s.events.append('register')
            if s.events.count('register') == 2:
                raise RuntimeError('resume scan failed')
        s.registration = scan
        def event(**data):
            if data.get('state') == 'paused':
                control.commands.put('resume')
        job = {'settings':{'depth':4,'force':21,'speed':2,'passes':2},'paths':[{'id':'a','body':'M400,400\x03D600,600\x03'}]}
        with patch.object(worker,'emit',side_effect=event),patch.object(worker,'write_exact',side_effect=lambda k,h,d:s.events.append(d)),self.assertRaisesRegex(RuntimeError,'resume scan failed'):
            worker.run('cut',job,session_factory=lambda **kw:s,control=control)
        self.assertEqual(len([e for e in s.events if isinstance(e,bytes)]),1)

    def test_status_padding_preserves_registration_ack_and_unknown_frames(self):
        for padding in range(4):
            for code in b'01234':
                frame = b' ' * padding + bytes([code]) + b'\x03'
                self.assertEqual(worker.normalize_status_frame(frame), bytes([code]) + b'\x03')
        for frame in [worker.original.REG_OK, b'     0\x03', b'0 \x03', b'\t0\x03', b'01\x03', b'0', b'-1\x03', b'9\x03']:
            self.assertEqual(worker.normalize_status_frame(frame), frame)

    def test_padded_connection_status_never_sends_movement(self):
        for frame, state in [(b' 0\x03','ready'), (b'   0\x03','ready'), (b' 1\x03','moving'), (b' 2\x03','unloaded')]:
            s = Session(None)
            s.reader = worker.FramedReader(Reader([frame[:2], frame[2:]]))
            writes = []
            with patch.object(worker,'write_exact',side_effect=lambda k,h,d:writes.append(d)), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(worker.run('status',session_factory=lambda **kw:s)['state'], state)
            self.assertEqual(writes,[worker.original.ESC_ENQ])
        for frame in [worker.original.REG_OK,b' 3\x03',b' 4\x03',b'01\x03']:
            s = Session(None)
            s.reader = Reader([frame])
            with patch.object(worker,'write_exact'), contextlib.redirect_stdout(io.StringIO()), self.assertRaises(worker.original.CameoError):
                worker.run('status',session_factory=lambda **kw:s)

    def test_padded_ready_initial_and_wait_keep_reader_and_never_accept_scan_ack(self):
        s = worker.Session()
        for method in [s._query_ready_initial,s.wait_ready]:
            r = s.reader = worker.FramedReader(Reader([b'  ', b' 0\x03']))
            with patch.object(worker.original,'_write_exact'):
                method()
            self.assertIs(s.reader,r)
            for frame in [worker.original.REG_OK,b' 2\x03',b' 3\x03',b' 4\x03',b'01\x03']:
                r = s.reader = Reader([frame])
                with patch.object(worker.original,'_write_exact'), self.assertRaises(worker.original.CameoError):
                    method()
                self.assertIs(s.reader,r)
        s.reader = Reader([b' 1\x03',b' 0\x03'])
        with patch.object(worker.original,'_write_exact'),patch.object(worker.original.time,'sleep'):
            s.wait_ready()
        s.reader = Reader([b' 1\x03'])
        with patch.object(worker.original,'_write_exact'), self.assertRaisesRegex(worker.original.CameoError,'MOVING'):
            s._query_ready_initial()

    def test_registration_requires_distinct_ack_then_padded_ready(self):
        s = worker.Session()
        s.registration_params = registration.normalize()
        r = s.reader = worker.FramedReader(Reader([b' 1\x03  ',b'  0\x03   0',b'\x03']))
        with patch.object(worker.original,'_write_exact'),patch.object(worker.original.time,'sleep'):
            s.registration()
        self.assertIs(s.reader,r)
        # A status READY, padded or otherwise, is not a successful registration.
        for frame in [b'   0\x03',b' 3\x03',b' 4\x03',b'-1\x03']:
            s.reader = Reader([frame])
            with patch.object(worker.original,'_write_exact'),patch.object(worker.original.time,'sleep'), self.assertRaises(worker.original.CameoError):
                s.registration()

    def test_blade_only_zero_then_target_never_scans_or_draws(self):
        class BladeSession(Session):
            configure_autoblade = worker.Session.configure_autoblade
        s = BladeSession(None)
        s.log = lambda message: None
        job = {'registration': registration.normalize(), 'settings': {'depth':4,'force':21,'speed':2,'passes':2}}
        with patch.object(worker, 'write_exact', side_effect=lambda k,h,d:s.events.append(d)), contextlib.redirect_stdout(io.StringIO()):
            result = worker.run('adjust-blade',job,session_factory=lambda **kw:s)
        writes = [e for e in s.events if isinstance(e, bytes)]
        self.assertEqual(writes,[registration.blade_setup(job['registration'],0,21,2),registration.blade_setup(job['registration'],4,21,2)])
        self.assertEqual(s.events,['ready',writes[0],'wait',writes[1],'wait','close'])
        self.assertNotIn('register',s.events)
        self.assertNotIn('home',s.events)
        self.assertEqual(result['state'],'ready')
        job['settings']['depth'] = 11
        s.events = []
        with self.assertRaises(ValueError):
            worker.run('adjust-blade',job,session_factory=lambda **kw:s)
        self.assertEqual(s.events,[])

    def test_calibration_scans_once_and_changes_tool_for_each_hexagon_only(self):
        trials = [{'label': label, 'settings': {'depth': i + 1, 'force': 10 + i, 'speed': 2, 'passes': 2},
                   'paths': [{'id': 'calibration-' + label, 'body': f'M400,{400+i*200}\x03D500,{450+i*200}\x03D400,{400+i*200}\x03'}]}
                  for i, label in enumerate('ABCDEF')]
        job = {'registration': registration.normalize(), 'trials': trials}
        s = Session(None)
        with patch.object(worker, 'write_exact', side_effect=lambda k,h,d:s.events.append(d)), contextlib.redirect_stdout(io.StringIO()):
            result = worker.run('calibrate', job, session_factory=lambda **kw:s)
        self.assertEqual(s.events.count('register'), 1)
        self.assertEqual(s.events.count('home'), 1)
        self.assertEqual(len([e for e in s.events if isinstance(e, tuple) and e[0] == 'blade']), 6)
        self.assertEqual([e for e in s.events if isinstance(e, bytes)], [t['paths'][0]['body'].encode() for t in trials for _ in range(2)])
        self.assertEqual(result['completed'], 12)
        s = Session(None)
        trials[-1]['settings']['force'] = 34
        with self.assertRaises(ValueError):
            worker.run('calibrate', job, session_factory=lambda **kw:s)
        self.assertEqual(s.events, [])

    def test_calibration_registration_failure_never_cuts_or_configures(self):
        s = Session(None)
        s.registration = lambda: (_ for _ in ()).throw(RuntimeError('scan failed'))
        trials = [{'label': l, 'settings': {'depth': 2, 'force': 10, 'speed': 2, 'passes': 1}, 'paths': [{'id':'calibration-'+l,'body':'M400,400\x03D500,500\x03'}]} for l in 'ABCDEF']
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, 'scan failed'):
            worker.run('calibrate', {'registration':registration.normalize(),'trials':trials}, session_factory=lambda **kw:s)
        self.assertEqual(s.events, ['ready', 'close'])

    def test_overcut_keeps_pen_up_between_segments_and_rejects_incomplete_runs(self):
        body = 'M400,398\x03D400,602\x03M398,600\x03D602,600\x03'
        job = {'settings': {'depth': 1, 'force': 10, 'speed': 2, 'passes': 1}, 'paths': [{'id': 'corner', 'body': body}]}
        worker.validate_job(job)
        s = Session(None)
        with patch.object(worker, 'write_exact', side_effect=lambda k,h,d:s.events.append(d)), contextlib.redirect_stdout(io.StringIO()):
            worker.run('cut', job, session_factory=lambda **kw:s)
        self.assertIn(body.encode('ascii'),s.events)
        for invalid in ['M400,400\x03M500,500\x03D600,600\x03','M400,400\x03D500,500\x03M600,600\x03']:
            job['paths'][0]['body'] = invalid
            with self.assertRaises(ValueError):
                worker.validate_job(job)

    def test_session_transmits_custom_registration_without_mutating_vendor(self):
        session = worker.Session()
        session.registration_params = registration.normalize(dict(leftMm=12,topMm=15,rightMm=18,bottomMm=20,armMm=15,thicknessMm=.5))
        session.reader = Reader([worker.original.REG_OK, worker.original.STATUS_READY])
        session.log = lambda msg: None
        captured, frozen = [], worker.original.BLOCK2
        with patch.object(worker.original, '_write_exact', side_effect=lambda k,h,d:captured.append(d)), patch.object(worker.original.time,'sleep'):
            session.registration()
        self.assertEqual(captured[0], worker.original.BLOCK1)
        self.assertEqual(captured[1], registration.block2(session.registration_params))
        self.assertEqual(captured[2], worker.original.ESC_ENQ)
        self.assertEqual(worker.original.BLOCK2, frozen)

    def test_default_blocks_and_blade_bytes_match_frozen_vendor(self):
        p = registration.normalize()
        self.assertEqual(registration.block2(p), worker.original.BLOCK2)
        session = Session(None)
        captured = []
        session.log = lambda msg: None
        with patch.object(worker.original, '_write_exact', side_effect=lambda k,h,d:captured.append(d)):
            worker.original.CameoSession.configure_autoblade(session, 4, 18, 2)
        self.assertEqual(captured, [registration.blade_setup(p, 4, 18, 2)])

    def test_portrait_custom_limits_are_applied(self):
        p = registration.normalize(dict(widthMm=210,heightMm=297,leftMm=12,topMm=15,rightMm=18,bottomMm=20,armMm=15,thicknessMm=.5))
        self.assertIn(b'TB123,5240,3600,218,158\x03',registration.block2(p))
        self.assertIn(b'Z5240,3600\x03',registration.blade_setup(p,1,10,2))
        job = {'settings': {'depth': 1, 'force': 10, 'speed': 2, 'passes': 1}, 'registration':p, 'paths': [{'id':'a','body':'M0,0\x03D5000,3500\x03'}]}
        worker.validate_job(job)
        job['paths'][0]['body'] = 'M0,0\x03D5300,3500\x03'
        with self.assertRaises(ValueError):
            worker.validate_job(job)

    def test_fragmented_and_coalesced_response(self):
        r = worker.FramedReader(Reader([b'  ', b'  0\x030', b'\x03']))
        self.assertEqual(r.get(1)[1], b'    0\x03')
        self.assertEqual(r.get(1)[1], b'0\x03')
    def test_incomplete_response_is_not_ready(self):
        r = worker.FramedReader(Reader([b'0']))
        with self.assertRaises(queue.Empty):
            r.get(.01)
    def test_validation_rejects_raw_commands(self):
        for body in ['M0,0\x03TB99\x03', 'M-1,0\x03D1,0\x03', 'M0,0\x03D4000,0\x03']:
            with self.assertRaises(ValueError):
                worker.validate_job({'settings': {'depth': 1, 'force': 10, 'speed': 2, 'passes': 1}, 'paths': [{'id': 'a', 'body': body}]})
    def test_exact_cut_sequence_and_repeated_passes(self):
        s = Session(None)
        job = {'settings': {'depth': 1, 'force': 10, 'speed': 2, 'passes': 2}, 'paths': [{'id': 'a', 'body': 'M400,400\x03D600,600\x03'}]}
        with patch.object(worker, 'write_exact', side_effect=lambda k,h,d:s.events.append(d)), contextlib.redirect_stdout(io.StringIO()):
            result = worker.run('cut', job, session_factory=lambda **kw:s)
        self.assertEqual(s.events, ['ready','register',('blade',(1,10,2)),b'M400,400\x03D600,600\x03','wait',b'M400,400\x03D600,600\x03','wait','home','close'])
        self.assertEqual(result['state'], 'completed')
    def test_registration_failure_never_configures_blade(self):
        s = Session(None)
        def fail():
            raise RuntimeError('marks failed')
        s.registration = fail
        job = {'settings': {'depth': 1, 'force': 10, 'speed': 2, 'passes': 1}, 'paths': [{'id': 'a', 'body': 'M0,0\x03D100,100\x03'}]}
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError,'marks failed'):
            worker.run('cut', job, session_factory=lambda **kw:s)
        self.assertEqual(s.events,['ready','close'])

if __name__ == '__main__':
    unittest.main()
