# Junta as cadeias (m0, fb, m1, fc; o trecho fa saiu: sentava num banquinho antes da hora) em transicoes/<nome>-fluido/<dir>-k.png, onde as três partes existem.
import os, shutil, sys
T = sys.argv[1]
for nome in ['sentar', 'deitar', 'deitar-lendo']:
    for d in ['south-east', 'south-west', 'north-east', 'north-west']:
        partes = [f'{T}/{nome}/{d}-0.png', f'{T}/{nome}-fb/{d}-0.png', f'{T}/{nome}-fb/{d}-1.png', f'{T}/{nome}/{d}-1.png', f'{T}/{nome}-fc/{d}-0.png', f'{T}/{nome}-fc/{d}-1.png']
        if not all(os.path.exists(p) for p in partes): continue
        os.makedirs(f'{T}/{nome}-fluido', exist_ok=True)
        for f in os.listdir(f'{T}/{nome}-fluido'):
            if f.startswith(d + '-'): os.remove(f'{T}/{nome}-fluido/{f}')
        for k, p in enumerate(partes): shutil.copy(p, f'{T}/{nome}-fluido/{d}-{k}.png')
        print(nome, d, 'ok')
