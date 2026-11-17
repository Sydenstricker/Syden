// Os candidatos e as fotos da medida do fundo da câmera (ver README.md).
//
// `entrada`: [largura, altura] que o modelo recebe. `normal`: 'zero-um' (só ÷255) ou 'menos-um-um' (média 0,5, desvio 0,5).
// `saida`: como ler a probabilidade de "pessoa" na saída.
const HF = 'https://huggingface.co';
export const MODELOS = [
  {
    id: 'mp-quadrado',
    nome: 'MediaPipe selfie (256 × 256)',
    arquivo: 'mediapipe-selfie.onnx',
    url: `${HF}/onnx-community/mediapipe_selfie_segmentation/resolve/main/onnx/model.onnx`,
    entrada: [256, 256],
    normal: 'zero-um',
    saida: 'unica',
    licenca: 'Apache 2.0 (Google; conversão onnx-community)',
  },
  {
    id: 'mp-paisagem',
    nome: 'MediaPipe selfie paisagem (256 × 144)',
    arquivo: 'mediapipe-selfie-paisagem.onnx',
    url: `${HF}/onnx-community/mediapipe_selfie_segmentation_landscape/resolve/main/onnx/model.onnx`,
    entrada: [256, 144],
    normal: 'zero-um',
    saida: 'unica',
    licenca: 'Apache 2.0 (Google; conversão onnx-community)',
  },
  {
    id: 'mp-multiclasse',
    nome: 'MediaPipe multiclasse (256 × 256)',
    arquivo: 'mediapipe-multiclasse.onnx',
    url: `${HF}/FreeHugsForRobots/ps-skin-seg/resolve/main/selfie_multiclass_256x256.onnx`,
    entrada: [256, 256],
    normal: 'zero-um',
    saida: 'multiclasse',
    licenca: 'Apache 2.0 (Google; conversão FreeHugsForRobots)',
  },
  {
    id: 'pphumanseg',
    nome: 'PP-HumanSeg (192 × 192)',
    arquivo: 'pphumanseg.onnx',
    url: `${HF}/opencv/human_segmentation_pphumanseg/resolve/main/human_segmentation_pphumanseg_2023mar.onnx`,
    entrada: [192, 192],
    normal: 'menos-um-um',
    saida: 'duas-classes',
    licenca: 'Apache 2.0 (PaddleSeg; OpenCV Zoo)',
  },
  {
    id: 'modnet-256',
    nome: 'MODNet (448 × 256)',
    arquivo: 'modnet.onnx',
    url: `${HF}/Xenova/modnet/resolve/main/onnx/model.onnx`,
    entrada: [448, 256],
    normal: 'menos-um-um',
    saida: 'unica',
    licenca: 'Apache 2.0 (ZHKKKe/MODNet; conversão Xenova)',
  },
  {
    id: 'modnet-512',
    nome: 'MODNet (896 × 512)',
    arquivo: 'modnet.onnx',
    url: `${HF}/Xenova/modnet/resolve/main/onnx/model.onnx`,
    entrada: [896, 512],
    normal: 'menos-um-um',
    saida: 'unica',
    licenca: 'Apache 2.0 (ZHKKKe/MODNet; conversão Xenova)',
  },
];

// Fotos do Wikimedia Commons (licenças livres; só para medir, nada disto vai ao Syden). `escura`: a mesma foto com pouca
// luz, como a webcam num quarto à noite (a imagem do relato dele).
export const FOTOS = [
  { arquivo: 'videochamada-sala.jpg', nome: 'Videochamada, sala de madeira', commons: 'Woman smiling and using laptop during video call in cozy wooden room.jpg' },
  { arquivo: 'videochamada-maos.jpg', nome: 'Videochamada, mãos se mexendo', commons: 'Cheerful woman smiling and making gestures with her hands while talking on a video call on her laptop.jpg' },
  { arquivo: 'cabelo-cacheado.jpg', nome: 'Cabelo cacheado, parede de tijolo', commons: 'Woman with curly hair smiles while taking a selfie in a cozy indoor setting with a brick wall.jpg' },
  { arquivo: 'fone-gamescom.jpg', nome: 'Fone de jogo, fundo cheio', commons: 'Gamer at Gamescom 2015 (20430203215).jpg' },
  { arquivo: 'fone-telefone.jpg', nome: 'Fone com microfone', commons: 'Man responds to telephone call.jpg' },
  { arquivo: 'oculos.jpg', nome: 'Óculos', commons: 'Sid Meier - Game Developers Conference 2010 - Day 4 (1).jpg' },
  { arquivo: 'cabana.jpg', nome: 'Videochamada, cabana com xícara', commons: 'Happy woman enjoying video call inside cabin with laptop and coffee cup.jpg' },
  { arquivo: 'fone-gamescom.jpg', nome: 'Fone de jogo, quarto escuro', escura: true },
  { arquivo: 'videochamada-sala.jpg', nome: 'Videochamada, quarto escuro', escura: true },
];

// Vídeos do Commons para a webcam simulada (medir-video.mjs): gente falando de frente para a câmera. Só para medir; ficam fora
// do git. `inicio` e `duracao` (s): o trecho usado. Licença e autor conferidos na página de cada um (15/11/2026).
export const VIDEOS = [
  {
    id: 'mensagem-cc0',
    nome: 'Mensagem em vídeo, sala com estante (1080p)',
    arquivo: 'mensagem-cc0.webm',
    commons: 'Video message from Rep. Alexandria Ocasio-Cortez.webm',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Video_message_from_Rep._Alexandria_Ocasio-Cortez.webm',
    licenca: 'CC0 1.0',
    autor: 'Climate Justice Alliance (via Vimeo)',
    inicio: 5,
    duracao: 20,
  },
  {
    id: 'webcam-torwali',
    nome: 'Mensagem de webcam, baixa resolução (400 × 222)',
    arquivo: 'webcam-torwali.webm',
    commons: 'Hasan Jameel gives a message in Torwali about Covid19 (video-converter.com).webm',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Hasan_Jameel_gives_a_message_in_Torwali_about_Covid19_%28video-converter.com%29.webm',
    licenca: 'CC BY 4.0',
    autor: 'Zubair Torwali',
    inicio: 10,
    duracao: 20,
  },
  {
    id: 'mensagem-hackathon',
    nome: 'Mensagem em vídeo, escritório (1080p)',
    arquivo: 'mensagem-hackathon.webm',
    commons: 'Wikimedia Hackathon 2016 video message from Wes Moran.webm',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Wikimedia_Hackathon_2016_video_message_from_Wes_Moran.webm',
    licenca: 'CC BY-SA 3.0',
    autor: 'VGrigas (WMF)',
    inicio: 3,
    duracao: 20,
  },
];
