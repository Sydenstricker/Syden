# Usado por sem-janela.py e plantas.py.
import numpy as np


def sem_buracos(img):
    """OS BURACOS DA COR DO FUNDO (auditoria de 10/11/2026): a base tem pixels exatamente da cor do fundo DENTRO da pintura (a
    borda esquerda da parede, x = 38; o canto do alto). A página só torna transparente o fundo que encosta na borda (fundoDe, no
    montar.mjs), então esses apareciam cinza na tela. O fundo que não se liga à borda vira a cor mais comum dos vizinhos que não
    são fundo nem contorno."""
    from scipy import ndimage
    out = img.copy(); fundo = img[0, 0].astype(int); H, W = img.shape[:2]
    e = np.abs(out[..., :3].astype(int) - fundo[:3]).max(2) <= 2
    rot, _ = ndimage.label(e)
    borda = set(np.unique(np.concatenate([rot[0], rot[-1], rot[:, 0], rot[:, -1]]))) - {0}
    buraco = e & ~np.isin(rot, list(borda))
    lum = out[..., :3].astype(float) @ [0.299, 0.587, 0.114]
    for y, x in zip(*np.nonzero(buraco)):
        cs = [tuple(out[yy, xx]) for yy in range(max(0, y - 1), min(H, y + 2)) for xx in range(max(0, x - 1), min(W, x + 2))
              if not e[yy, xx] and lum[yy, xx] > 45]
        if cs: out[y, x] = max(set(cs), key=cs.count)
    return out
