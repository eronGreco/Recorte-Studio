"""Physical registration layout. Same 0.05 mm grid and defaults as the JS model."""
import math

DEFAULTS = dict(widthMm=297, heightMm=210, leftMm=10, topMm=10, rightMm=10, bottomMm=10, armMm=10, thicknessMm=1)


def normalize(value=None):
    if value is not None and (not isinstance(value, dict) or set(value) - set(DEFAULTS)):
        raise ValueError("Configuração de marcas inválida.")
    p = {**DEFAULTS, **(value or {})}
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in p.values()):
        raise ValueError("Medidas das marcas inválidas.")
    if (p['widthMm'], p['heightMm']) not in ((297, 210), (210, 297)):
        raise ValueError("Use A4 em retrato ou paisagem.")
    if any(not 5 <= p[k] <= 50 for k in ('leftMm', 'topMm', 'rightMm', 'bottomMm')):
        raise ValueError("As margens devem ficar entre 5 e 50 mm.")
    if not 5 <= p['armMm'] <= 20 or not .3 <= p['thicknessMm'] <= 1:
        raise ValueError("Dimensões das marcas fora dos limites.")
    p = {k: round(v * 20) / 20 for k, v in p.items()}
    width = p['widthMm'] - p['leftMm'] - p['rightMm']
    height = p['heightMm'] - p['topMm'] - p['bottomMm']
    if min(width, height) < 2 * p['armMm'] + 10:
        raise ValueError("As marcas estão próximas demais.")
    return p


def area_su(p):
    return round((p['heightMm'] - p['topMm'] - p['bottomMm']) * 20), round((p['widthMm'] - p['leftMm'] - p['rightMm']) * 20)


def block2(p):
    height, width = area_su(p)
    # Preserve the canonical captured search lead-in while moving the marks.
    top, left = round((p['topMm'] - 4.1) * 20), round((p['leftMm'] - 4.1) * 20)
    return (f"TB52,2\x03TB51,{round(p['armMm']*20)}\x03TB53,{round(p['thicknessMm']*20)}\x03"
            f"TB55,1\x03TB123,{height},{width},{top},{left}\x03TB99\x03").encode('ascii')


def blade_setup(p, depth, force, speed):
    height, width = area_su(p)
    commands = [r'\0,0', f'Z{height},{width}', 'J1', f'FX{force},1', 'TJ0', f'!{speed},1', 'FC0,1,1', 'FE0,1', 'FF1,0,1', 'FF1,1,1', f'FX{force},1', 'TJ3', 'FC18,1,1', f'TF{depth},1']
    return ''.join(c+'\x03' for c in commands).encode('ascii')
