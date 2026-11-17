/**
 * O computador abre WebGL? A pergunta cria um contexto de verdade, e o navegador só aguenta uns 16 vivos: perguntada a cada
 * desenho (a Batalha naval fazia isso), ela esgotava o limite em ~25 tiros ("Too many active WebGL contexts") e os dois mares
 * 3D apagavam. Por isso a resposta é guardada (uma pergunta por página) e o contexto do teste é devolvido na hora.
 */
let resposta: boolean | null = null;

export function temWebGL(): boolean {
  if (resposta !== null) return resposta;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    resposta = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    resposta = false;
  }
  return resposta;
}
