# Os candidatos do PaddleSeg (Apache 2.0) para a medida do fundo da câmera (ver README.md, "Os refinados"): baixa os modelos
# de inferência OFICIAIS (paddleseg.bj.bcebos.com, os links do README do PaddleSeg 2.9) e os converte para ONNX com o
# paddle2onnx. Ninguém publica estes em ONNX com origem confiável, então a conversão é nossa, e a origem é o zip oficial.
#
# Pede um Python 3.12 com o Paddle (o 3.14 não tem roda dele):
#   py -3.12 -m venv <pasta>  &&  <pasta>/Scripts/python -m pip install paddlepaddle==2.6.2 paddle2onnx==1.3.1 setuptools onnx onnxconverter-common
#   <pasta>/Scripts/python e2e/fundo-da-camera/converter-paddle.py
# Sai em modelos/ (fora do git), ao lado dos baixados por baixar.mjs.
import hashlib
import os
import subprocess
import sys
import urllib.request
import zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELOS = os.path.join(AQUI, 'modelos')
CACHE = os.path.join(MODELOS, 'paddle')
BASE = 'https://paddleseg.bj.bcebos.com/'
MATTING = 'matting/models/deploy/ppmattingv2-stdc1-human_512.zip'
LISTA = {
    # o PP-HumanSeg v2 de RETRATO, 256 × 144 (16:9, a proporção da webcam)
    'ppseg-v2-retrato': ('dygraph/pp_humanseg_v2/portrait_pp_humansegv2_lite_256x144_smaller/portrait_pp_humansegv2_lite_256x144_inference_model_with_softmax.zip', 256, 144),
    # o v2 "geral", leve e o médio, 192 × 192
    'ppseg-v2-leve': ('dygraph/pp_humanseg_v2/human_pp_humansegv2_lite_192x192_inference_model_with_softmax.zip', 192, 192),
    'ppseg-v2-medio': ('dygraph/pp_humanseg_v2/human_pp_humansegv2_mobile_192x192_inference_model_with_softmax.zip', 192, 192),
    # o v1 "servidor", 512 × 512 (107 MB: só para saber até onde vai)
    'ppseg-v1-servidor': ('dygraph/pp_humanseg_v2/human_pp_humansegv1_server_512x512_inference_model_with_softmax.zip', 512, 512),
    # o PP-MattingV2 (recorte com transparência de verdade, não segmentação). O treino guarda a proporção, mas as médias
    # adaptativas dele (2, 4 e 6 sobre o quadro a 1/64; 128 e 256 sobre a imagem) só viram ONNX com lados que se dividem bem:
    # 512 × 288 e 640 × 352 saem quebrados (um AveragePool de passo zero). Cabem 512 × 512 (a webcam espremida, como os
    # PP-HumanSeg) e 768 × 512 (1,5:1, perto dos 16:9)
    'ppmatting-v2': (MATTING, 512, 512),
    'ppmatting-v2-768': (MATTING, 768, 512),
}




def fixar(pasta, saida, w, h):
    """O modelo de inferência vem com a entrada de tamanho livre, e a média adaptativa do v2 (o pool2d 'adaptive') sai quebrada
    do paddle2onnx assim ("Adaptive only support static input shape": um AveragePool de passo zero, que o onnxruntime recusa).
    Fixar a entrada e refazer a inferência de formas de cada operação, no próprio Paddle, resolve."""
    import paddle
    paddle.enable_static()
    exe = paddle.static.Executor(paddle.CPUPlace())
    prog, feeds, fetches = paddle.static.load_inference_model(os.path.join(pasta, 'model'), exe)
    blk = prog.global_block()
    blk.var(feeds[0]).desc.set_shape([1, 3, h, w])
    for op in blk.ops:
        if op.type not in ('feed', 'fetch'):
            op.desc.infer_shape(blk.desc)
    paddle.static.save_inference_model(os.path.join(saida, 'model'), [blk.var(n) for n in feeds], fetches, exe, program=prog)


os.makedirs(CACHE, exist_ok=True)
paddle2onnx = os.path.join(os.path.dirname(sys.executable), 'paddle2onnx')
for nome, (caminho, w, h) in LISTA.items():
    destino = os.path.join(MODELOS, nome + '.onnx')
    if os.path.exists(destino):
        continue
    arq = os.path.join(CACHE, os.path.basename(caminho))
    if not os.path.exists(arq):
        print('baixando', caminho)
        urllib.request.urlretrieve(BASE + caminho, arq)
    pasta = arq[:-4]
    with zipfile.ZipFile(arq) as z:
        z.extractall(pasta)
    interna = os.path.join(pasta, os.path.basename(pasta))
    fixa = os.path.join(CACHE, f'{nome}-{w}x{h}')
    fixar(interna, fixa, w, h)
    subprocess.run([paddle2onnx, '--model_dir', fixa, '--model_filename', 'model.pdmodel', '--params_filename', 'model.pdiparams',
                    '--opset_version', '13', '--save_file', destino], check=True)
    with open(arq, 'rb') as f:
        zsha = hashlib.sha256(f.read()).hexdigest()
    with open(destino, 'rb') as f:
        osha = hashlib.sha256(f.read()).hexdigest()
    print(f'{nome}: zip {zsha}  onnx {osha}  {os.path.getsize(destino) / 1e6:.1f} MB')

# O PP-MattingV2 em MEIA PRECISÃO (fp16), para a placa: metade do arquivo (18 MB), mais rápido pelo DirectML, e a saída difere
# da de 32 bits em no máximo 0,002 de alfa (medido em 17/11/2026). A entrada e a saída continuam em 32 bits. Pede o
# onnxconverter-common (pip install onnxconverter-common). Os Resize do paddle2onnx levam o tamanho de saída E um `scales`
# vazio; a conversão para 16 bits estragava o vazio ("Either sizes or scales must be provided"), então o roi e o scales
# saem antes, como a especificação permite quando há `sizes`.
fp16 = os.path.join(MODELOS, 'ppmatting-v2-fp16.onnx')
if not os.path.exists(fp16):
    import onnx
    from onnxconverter_common import float16
    m = onnx.load(os.path.join(MODELOS, 'ppmatting-v2.onnx'))
    for n in m.graph.node:
        if n.op_type == 'Resize' and len(n.input) == 4 and n.input[3]:
            n.input[1] = ''
            n.input[2] = ''
    m = float16.convert_float_to_float16(m, keep_io_types=True)
    # o roi e o scales que saíram ficam sem uso: fora (as constantes e os valores guardados), senão o onnxruntime avisa de
    # cada um ao abrir
    usados = {i for n in m.graph.node for i in n.input} | {o.name for o in m.graph.output}
    for n in [n for n in m.graph.node if n.op_type == 'Constant' and n.output[0] not in usados]:
        m.graph.node.remove(n)
    for ini in [i for i in m.graph.initializer if i.name not in usados]:
        m.graph.initializer.remove(ini)
    onnx.save(m, fp16)
    with open(fp16, 'rb') as f:
        print(f'ppmatting-v2-fp16: onnx {hashlib.sha256(f.read()).hexdigest()}  {os.path.getsize(fp16) / 1e6:.1f} MB')
