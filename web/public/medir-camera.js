// A medição da câmera do celular (ver medir-camera.html). Para cada câmera do aparelho: o que ela diz que deixa ajustar
// (getCapabilities), como está agora (getSettings), e um TESTE de verdade do zoom e da lanterna (applyConstraints e ler de
// volta), porque há navegador que anuncia e não aplica.
(() => {
  const estado = document.getElementById('estado');
  const saida = document.getElementById('saida');
  const copiar = document.getElementById('copiar');
  const dizer = (t) => (estado.textContent = t);
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  async function testar(faixa, nome, valor) {
    try {
      await faixa.applyConstraints({ advanced: [{ [nome]: valor }] });
      await esperar(400);
      return { pedido: valor, ficou: faixa.getSettings()[nome] };
    } catch (e) {
      return { pedido: valor, erro: String((e && e.name) || e) };
    }
  }

  async function medirCamera(dispositivo) {
    const r = { rotulo: dispositivo.label || '(sem nome)' };
    let fluxo;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: dispositivo.deviceId } }, audio: false });
    } catch (e) {
      r.erro = String((e && e.name) || e);
      return r;
    }
    const faixa = fluxo.getVideoTracks()[0];
    await esperar(500);
    r.ajustes = faixa.getSettings ? faixa.getSettings() : null;
    delete r.ajustes?.deviceId;
    delete r.ajustes?.groupId;
    r.capacidades = faixa.getCapabilities ? faixa.getCapabilities() : 'sem getCapabilities';
    if (r.capacidades && typeof r.capacidades === 'object') {
      delete r.capacidades.deviceId;
      delete r.capacidades.groupId;
      const c = r.capacidades;
      r.testes = {};
      if (c.zoom && typeof c.zoom.max === 'number') {
        r.testes.zoomMaximo = await testar(faixa, 'zoom', Math.min(c.zoom.max, (c.zoom.min ?? 1) * 2));
        r.testes.zoomDeVolta = await testar(faixa, 'zoom', c.zoom.min ?? 1);
      }
      if ('torch' in c) {
        r.testes.lanternaAcesa = await testar(faixa, 'torch', true);
        r.testes.lanternaApagada = await testar(faixa, 'torch', false);
      }
      if (c.exposureCompensation && typeof c.exposureCompensation.max === 'number') {
        r.testes.exposicao = await testar(faixa, 'exposureCompensation', c.exposureCompensation.max / 2);
      }
      if (Array.isArray(c.focusMode) && c.focusMode.includes('single-shot')) {
        r.testes.focarNoPonto = await testar(faixa, 'pointsOfInterest', [{ x: 0.3, y: 0.3 }]);
      }
    }
    for (const f of fluxo.getTracks()) f.stop();
    return r;
  }

  document.getElementById('medir').addEventListener('click', async () => {
    saida.hidden = true;
    copiar.hidden = true;
    const resultado = {
      quando: new Date().toISOString(),
      navegador: navigator.userAgent,
      tela: [screen.width, screen.height, devicePixelRatio],
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('este navegador não abre a câmera');
      resultado.restricoesConhecidas = navigator.mediaDevices.getSupportedConstraints();
      dizer('Pedindo a câmera…');
      // a primeira abertura é para o navegador liberar os nomes das câmeras
      const primeira = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      for (const f of primeira.getTracks()) f.stop();
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      resultado.cameras = [];
      for (let i = 0; i < cameras.length; i++) {
        dizer(`Medindo a câmera ${i + 1} de ${cameras.length}…`);
        resultado.cameras.push(await medirCamera(cameras[i]));
      }
      dizer(`Pronto: ${cameras.length} câmera(s). Toque em "Copiar o resultado" e mande na conversa.`);
    } catch (e) {
      resultado.erro = String((e && (e.message || e.name)) || e);
      dizer('Não deu para medir: ' + resultado.erro);
    }
    saida.textContent = JSON.stringify(resultado, null, 1);
    saida.hidden = false;
    copiar.hidden = false;
  });

  copiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(saida.textContent);
      dizer('Copiado. Agora é só colar na conversa.');
    } catch {
      // sem a área de transferência: seleciona o texto para copiar à mão
      const faixa = document.createRange();
      faixa.selectNodeContents(saida);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(faixa);
      dizer('Selecionei o texto: toque em Copiar no menu do celular.');
    }
  });
})();
