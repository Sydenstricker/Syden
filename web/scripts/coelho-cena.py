# O COELHO DE CADA UM NA CENA (10/11/2026, pedido dele: "um ecossistema integrado"): o irmão de coelho-camadas.py, para o
# quarto e o salão de pixel art (e2e/pixel-art/quarto/novo/quarto/montar.mjs). Lá o coelho usa mais poses que o criador
# (as de FONTES, no montar.mjs: sentado, no sofá, deitado, as passagens...), e cada uma pode vir de pastas diferentes. Quem
# escolhe a pasta é o montar.mjs (o mesmo FONTES do mascote, e a pose mais perto do MESMO corpo onde falta); aqui sai, para
# TODO quadro de pose dos três corpos, o que a troca de paleta e os acessórios precisam, com a mesma conta do criador:
#   - o MAPA de classes de cada quadro (pelo = 1, roupa = 2, o resto = 3; classes_de_cor.py), numa tira por pasta;
#   - o tom de referência do quadro 0 de cada direção, por pasta (fixo na direção: a auditoria das camadas);
#   - onde o boné e a bandana vão em cada quadro (camadas/relatorio.json, de acessorio-camadas.py), ou null ("sem": deitado,
#     ou a cabeça mudou de forma).
# A camada de cada acessório é a mesma do criador: <corpo>/acessorios/<acessório>/parado/<direção>-0.png.
#
#   py -3 web/scripts/coelho-cena.py   → e2e/pixel-art/personagem/cena/ (dados.json e as tiras dos mapas)
# Rode de novo depois de qualquer corpo, pose ou acessório novo, nesta ordem: acessorio-camadas.py, este, e o montar.mjs.
import io, json, os, re, sys, hashlib
import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(RAIZ, 'e2e', 'pixel-art', 'personagem')
SAIDA = os.path.join(P, 'cena')
sys.path.insert(0, P)
from classes_de_cor import cls, referencias  # noqa: E402

CORPOS = ['mascote', 'orelha-caida', 'musculoso', 'mascote-f-moletom', 'musculoso-f-curta']
ACESSORIOS = ['bone', 'bandana']
DIRS = ['south-east', 'south-west', 'north-east', 'north-west', 'south', 'west', 'north', 'east']
NOME = re.compile(r'^(' + '|'.join(sorted(DIRS, key=len, reverse=True)) + r')(?:-(\d+))?\.png$')

rel = json.load(open(os.path.join(P, 'camadas', 'relatorio.json'), encoding='utf-8'))


def salvar(im, caminho):
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    novo = buf.getvalue()
    if os.path.exists(caminho) and open(caminho, 'rb').read() == novo: return
    open(caminho, 'wb').write(novo)


def pastas_de(corpo):
    """As pastas de pose de um corpo, relativas a ele (com /): as rotações, as animações, os estados e as passagens."""
    r = ['baixa-120']
    for pai in ['baixa-120/animacoes', 'estados', 'transicoes']:
        d = os.path.join(P, corpo, pai)
        if os.path.isdir(d): r += [f'{pai}/{x}' for x in sorted(os.listdir(d)) if os.path.isdir(os.path.join(d, x))]
    return r


def chave_do_relatorio(corpo, pasta):
    """A chave da pasta no relatorio.json (ver o topo de acessorio-camadas.py)."""
    if pasta.startswith('baixa-120/animacoes/'):
        x = pasta.split('/')[-1]
        if corpo == 'mascote' and x == 'andando': return None  # a caminhada antiga (o relatório do andar é a v3)
        if corpo == 'mascote' and x in ('andando-v3', 'andando-v3b'): return 'andando'
        return x
    if pasta.startswith('estados/') or pasta.startswith('transicoes/'): return pasta
    return None


os.makedirs(SAIDA, exist_ok=True)
dados = {'corpos': {}}
for c in CORPOS:
    os.makedirs(os.path.join(SAIDA, c), exist_ok=True)
    corpo = dados['corpos'][c] = {'camadas': {}, 'pastas': {}}
    for acc in ACESSORIOS:
        for d in DIRS:
            if os.path.exists(os.path.join(P, c, 'acessorios', acc, 'parado', f'{d}-0.png')): corpo['camadas'].setdefault(acc, []).append(d)
    for pasta in pastas_de(c):
        dirp = os.path.join(P, c, *pasta.split('/'))
        arquivos = []
        for f in os.listdir(dirp):
            m = NOME.match(f)
            if m: arquivos.append((m.group(1), int(m.group(2)) if m.group(2) else -1, f))
        if not arquivos: continue
        arquivos.sort()
        quadros = [(d, k, f, np.array(Image.open(os.path.join(dirp, f)).convert('RGBA'))) for d, k, f in arquivos]
        altura = max(a.shape[0] for *_, a in quadros)
        tira = Image.new('L', (sum(a.shape[1] for *_, a in quadros), altura))
        entrada = {'arquivos': {}, 'refs': {}, 'acc': {}}
        x = 0
        for d, k, f, a in quadros:
            m = cls(a, c)
            tira.paste(Image.fromarray((m * 80).astype(np.uint8), 'L'), (x, 0))
            entrada['arquivos'][f] = [x, a.shape[1], a.shape[0]]
            x += a.shape[1]
            if d not in entrada['refs'] and k <= 0:
                ref = referencias(a, m)
                entrada['refs'][d] = [round(ref[1], 3), round(ref[2], 3)]
        # (a direção sem o quadro 0: o primeiro dela)
        for d, k, f, a in quadros:
            if d not in entrada['refs']:
                ref = referencias(a, cls(a, c)); entrada['refs'][d] = [round(ref[1], 3), round(ref[2], 3)]
        chave = chave_do_relatorio(c, pasta)
        for acc in ACESSORIOS:
            lugares = {}
            for d in set(q[0] for q in quadros):
                lista = rel.get(f'{c}/{acc}/{chave}/{d}') if chave else None
                if not lista or d not in corpo['camadas'].get(acc, []): continue
                for q in lista:
                    lugares[q['quadro']] = None if q.get('sem') else q['desloc']
            if lugares: entrada['acc'][acc] = lugares
        # a pose que acessorio-camadas.py ainda não viu (nenhuma chave dela no relatório): o montar.mjs a deixa de fora, com um
        # aviso, até ele rodar; senão o boné sumiria nela (e piscaria, numa animação de reação)
        if chave and not any(k.startswith(f'{c}/{a}/{chave}/') for a in ACESSORIOS for k in rel):
            entrada['semRelatorio'] = True
        nome = pasta.replace('/', '~') + '.png'
        salvar(tira, os.path.join(SAIDA, c, nome))
        entrada['mapa'] = f'{c}/{nome}'
        corpo['pastas'][pasta] = entrada

h = hashlib.sha1()
for raiz, _, arquivos in os.walk(SAIDA):
    for f in sorted(arquivos):
        if f.endswith('.png'): h.update(f.encode()); h.update(open(os.path.join(raiz, f), 'rb').read())
dados['versao'] = h.hexdigest()[:10]
json.dump(dados, open(os.path.join(SAIDA, 'dados.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('ok', dados['versao'], {c: len(v['pastas']) for c, v in dados['corpos'].items()})
