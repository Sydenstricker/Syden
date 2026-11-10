# O COELHO MONTADO NO APP (10/11/2026, pedido dele: "gostei da tela de criação, pode implementar ao Syden?"): leva os
# sprites dos corpos (e2e/pixel-art/personagem/<corpo>/), o mapa de classes de cada quadro (pelo = 1, roupa = 2, o resto = 3;
# classes_de_cor.py) e as camadas do boné e da bandana (acessorio-camadas.py, camadas/relatorio.json) para web/public/coelho/,
# onde web/src/coelho/montar.ts os combina na hora com as cores da receita da pessoa (a troca de paleta do criador).
#
# Por animação e direção, UMA tira: os quadros lado a lado, cada um centrado num quadrado de LADO px (os quadros do PixelLab
# têm tamanhos diferentes: 120, 132, 140). E a tira do mapa, em tons de cinza (a classe × 80). A camada de cada acessório é a
# pintura do quadro 0 do parado naquela direção, e dados.json diz onde ela vai em cada quadro (já no quadrado), ou null
# quando o quadro fica sem o acessório (deitado, dormindo: o rastreio da cabeça não vale ali).
#
#   py -3 web/scripts/coelho-camadas.py
# Rode de novo depois de qualquer corpo, animação ou acessório novo (e da auditoria das camadas com 0 marcas).
import io, json, os, sys, hashlib
import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(RAIZ, 'e2e', 'pixel-art', 'personagem')
SAIDA = os.path.join(RAIZ, 'web', 'public', 'coelho')
sys.path.insert(0, P)
from classes_de_cor import cls, referencias  # noqa: E402

LADO = 144
CORPOS = ['mascote', 'orelha-caida', 'musculoso', 'mascote-f-moletom', 'musculoso-f-curta']
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
ACESSORIOS = ['bone', 'bandana']
# o que o app usa hoje: o palco da Aparência (parado e o aceno ao clicar). As poses do quarto e do salão são do irmão deste,
# coelho-cena.py (para a página da cena, montar.mjs).
ANIMACOES = {'parado': DIRS, 'acenando': ['south-east', 'south-west']}
# a pasta de cada animação, quando não é a do nome (o andar do mascote é o v3)
PASTA = {('mascote', 'andando'): 'andando-v3'}

rel = json.load(open(os.path.join(P, 'camadas', 'relatorio.json'), encoding='utf-8'))
os.makedirs(SAIDA, exist_ok=True)


def salvar(im, caminho):
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    novo = buf.getvalue()
    if os.path.exists(caminho) and open(caminho, 'rb').read() == novo: return
    open(caminho, 'wb').write(novo)


dados = {'lado': LADO, 'corpos': {}}
for c in CORPOS:
    os.makedirs(os.path.join(SAIDA, c), exist_ok=True)
    corpo = dados['corpos'][c] = {'animacoes': {}, 'camadas': {}}
    for acc in ACESSORIOS:
        for d in DIRS:
            camada = os.path.join(P, c, 'acessorios', acc, 'parado', f'{d}-0.png')
            if os.path.exists(camada):
                salvar(Image.open(camada).convert('RGBA'), os.path.join(SAIDA, c, f'{acc}-{d}.png'))
                corpo['camadas'].setdefault(acc, []).append(d)
    for an, dirs in ANIMACOES.items():
        pasta = os.path.join(P, c, 'baixa-120', 'animacoes', PASTA.get((c, an), an))
        for d in dirs:
            quadros = []
            k = 0
            while os.path.exists(os.path.join(pasta, f'{d}-{k}.png')):
                quadros.append(np.array(Image.open(os.path.join(pasta, f'{d}-{k}.png')).convert('RGBA'))); k += 1
            if not quadros: continue
            tira = Image.new('RGBA', (LADO * len(quadros), LADO))
            mapa = Image.new('L', (LADO * len(quadros), LADO))
            pads, ref = [], None
            for i, a in enumerate(quadros):
                m = cls(a, c)
                if i == 0: ref = referencias(a, m)
                pad = (LADO - a.shape[0]) // 2
                padx = (LADO - a.shape[1]) // 2
                pads.append([padx, pad])
                tira.paste(Image.fromarray(a), (i * LADO + padx, pad))
                mapa.paste(Image.fromarray((m * 80).astype(np.uint8), 'L'), (i * LADO + padx, pad))
            salvar(tira, os.path.join(SAIDA, c, f'{an}-{d}.png'))
            salvar(mapa, os.path.join(SAIDA, c, f'{an}-{d}-mapa.png'))
            entrada = {'n': len(quadros), 'ref': {str(k): float(v) for k, v in (ref or {}).items()}, 'acessorios': {}}
            for acc in ACESSORIOS:
                lista = rel.get(f'{c}/{acc}/{an}/{d}')
                if not lista or d not in corpo['camadas'].get(acc, []): continue
                # onde a camada vai em cada quadro, já no quadrado: o canto do quadro + o deslocamento medido
                entrada['acessorios'][acc] = [None if q.get('sem') else [pads[i][0] + q['desloc'][0], pads[i][1] + q['desloc'][1]] for i, q in enumerate(lista[: len(quadros)])]
            corpo['animacoes'].setdefault(an, {})[d] = entrada

# a VERSÃO dos arquivos: entra no endereço que o app pede, para o navegador não guardar a tira velha depois de uma troca
h = hashlib.sha1()
for raiz, _, arquivos in os.walk(SAIDA):
    for f in sorted(arquivos):
        if f.endswith('.png'): h.update(f.encode()); h.update(open(os.path.join(raiz, f), 'rb').read())
dados['versao'] = h.hexdigest()[:10]
json.dump(dados, open(os.path.join(SAIDA, 'dados.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('ok', dados['versao'], {c: list(v['animacoes']) for c, v in dados['corpos'].items()})
