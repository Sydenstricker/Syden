# Converte o gtcrn.onnx num formato que JavaScript puro lê sem biblioteca nenhuma:
#   gtcrn.json — a lista de operações, na ordem, com atributos e formas; e onde cada peso mora no .bin
#   gtcrn.bin  — os pesos float32, colados um depois do outro
# As constantes inteiras (formas, índices, eixos) vão direto no JSON, que são poucas.
import json, sys
import numpy as np
import onnx
from onnx import numpy_helper, helper, shape_inference

m = shape_inference.infer_shapes(onnx.load(sys.argv[1]))
g = m.graph

formas = {}
for v in list(g.input) + list(g.output) + list(g.value_info):
    d = v.type.tensor_type.shape.dim
    formas[v.name] = [x.dim_value for x in d]

pesos, inteiros, partes, pos = {}, {}, [], 0
for i in g.initializer:
    a = numpy_helper.to_array(i)
    if a.dtype in (np.int64, np.int32):
        inteiros[i.name] = {'forma': list(a.shape), 'dados': a.astype(np.int64).ravel().tolist()}
    else:
        a = a.astype('<f4')
        pesos[i.name] = {'forma': list(a.shape), 'inicio': pos // 4, 'tamanho': int(a.size)}
        partes.append(a.tobytes())
        pos += a.nbytes

def attr(a):
    v = helper.get_attribute_value(a)
    if isinstance(v, bytes): return v.decode()
    if isinstance(v, (list, tuple)): return [int(x) if isinstance(x, (int, np.integer)) else float(x) for x in v]
    if isinstance(v, (np.integer, int)): return int(v)
    if isinstance(v, (float, np.floating)): return float(v)
    raise ValueError(a.name)

nos = []
for n in g.node:
    nos.append({'op': n.op_type, 'ent': list(n.input), 'sai': list(n.output),
                'attr': {a.name: attr(a) for a in n.attribute},
                'formas': [formas.get(o) for o in n.output]})

json.dump({'entradas': [i.name for i in g.input], 'saidas': [o.name for o in g.output],
           'formasEntrada': {i.name: formas[i.name] for i in g.input},
           'pesos': pesos, 'inteiros': inteiros, 'nos': nos}, open(sys.argv[2], 'w'), separators=(',', ':'))
open(sys.argv[3], 'wb').write(b''.join(partes))
print(len(nos), 'nós,', len(pesos), 'pesos float,', len(inteiros), 'constantes inteiras,', pos, 'bytes; formas desconhecidas:',
      sum(1 for n in nos for f in n['formas'] if not f or 0 in f))
