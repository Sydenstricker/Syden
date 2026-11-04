import { ClipboardPaste, Megaphone } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { type AvisoDoServidor, enderecoDaFotoDoAviso } from './AvisoGeral';
import { useT } from './i18n';
import { imageFromClipboard, imageFromClipboardEvent } from './upload';

// Onde quem administra escreve o recado que todo mundo vê — inclusive quem ainda nem entrou.
//
// A hora de terminar é o campo que mais importa, e por isso ele tem atalhos: a manutenção acaba às 23h
// e quem administra vai dormir. Sem hora de fim, a faixa vermelha amanhece na tela de todo mundo
// dizendo que o Syden está em manutenção quando ele está perfeito — e aí ninguém mais acredita nela.

const TONS: { id: AvisoDoServidor['tom']; nome: string; dica: string }[] = [
  { id: 'manutencao', nome: 'Manutenção', dica: 'O Syden vai sair do ar de propósito.' },
  { id: 'problema', nome: 'Problema', dica: 'Alguma coisa está ruim agora e você já sabe.' },
  { id: 'recado', nome: 'Recado', dica: 'Uma novidade, um convite, um agradecimento.' },
];

/** A data no formato que o campo do navegador entende, na hora local de quem está escrevendo. */
function paraCampo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // O campo datetime-local não aceita fuso; o valor tem que ir já convertido para a hora da pessoa.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** O teto do servidor para a foto do recado (PUT /api/aviso/imagem). */
const FOTO_MAXIMA = 4 * 1024 * 1024;
/** O lado maior da foto: é uma foto para ver grande, mas não precisa passar disso numa tela. */
const LADO_MAXIMO = 1600;

const comoDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
    leitor.readAsDataURL(blob);
  });

/**
 * A foto escolhida, pronta para subir: INTEIRA (sem recorte, ao contrário da capa: é uma foto para ser vista), reduzida
 * até 1600 px no lado maior, em WEBP. O GIF passa como veio, para não perder a animação.
 */
async function prepararFoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.type === 'image/gif') {
    if (file.size > FOTO_MAXIMA) throw new Error('Cada arquivo pode ter até 4 MB.');
    return comoDataUrl(file);
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível abrir essa imagem.');
  });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob) throw new Error('Não foi possível processar essa imagem.');
  if (blob.size > FOTO_MAXIMA) throw new Error('Cada arquivo pode ter até 4 MB.');
  return comoDataUrl(blob);
}

/** Daqui a tantos minutos, no formato do campo. Os atalhos de "termina em…". */
function daquiA(minutos: number): string {
  return paraCampo(new Date(Date.now() + minutos * 60_000).toISOString());
}

export function PainelDeAviso() {
  const t = useT();
  const [texto, setTexto] = useState('');
  const [tom, setTom] = useState<AvisoDoServidor['tom']>('manutencao');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [valendo, setValendo] = useState(false);
  const [existe, setExiste] = useState(false);
  const [estado, setEstado] = useState<'lendo' | 'parado' | 'salvando'>('lendo');
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  // A foto do recado: o sha que vai no recado ao salvar (a subida acontece ao escolher), ou null.
  const [imagem, setImagem] = useState<string | null>(null);
  const [subindoFoto, setSubindoFoto] = useState(false);
  // A prévia da foto recém-escolhida vem da cópia local: a rota pública só abre a foto do recado JÁ salvo.
  const [previa, setPrevia] = useState<string | null>(null);

  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setSalvo(false);
    setSubindoFoto(true);
    try {
      const image = await prepararFoto(file);
      const resposta = await api<{ imagem: { sha: string } }>('/api/aviso/imagem', { method: 'PUT', body: { image } });
      setImagem(resposta.imagem.sha);
      setPrevia(image);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSubindoFoto(false);
    }
  }

  // Ctrl+V em qualquer lugar do painel: quem copiou a imagem (do navegador, de um recorte da tela) não precisa salvar
  // arquivo antes. Só a imagem é tomada; colar TEXTO no campo do recado continua colando texto.
  useEffect(() => {
    const aoColar = (evento: ClipboardEvent) => {
      const arquivo = imageFromClipboardEvent(evento);
      if (!arquivo) return;
      evento.preventDefault();
      void escolherFoto(arquivo);
    };
    window.addEventListener('paste', aoColar);
    return () => window.removeEventListener('paste', aoColar);
  });

  function receber(resposta: { aviso: AvisoDoServidor | null; valendo: boolean }) {
    setImagem(resposta.aviso?.imagem?.sha ?? null);
    setPrevia(null);
    setExiste(resposta.aviso !== null);
    setValendo(resposta.valendo);
    setTexto(resposta.aviso?.texto ?? '');
    setTom(resposta.aviso?.tom ?? 'manutencao');
    setDe(paraCampo(resposta.aviso?.de ?? null));
    setAte(paraCampo(resposta.aviso?.ate ?? null));
    setEstado('parado');
  }

  useEffect(() => {
    void api<{ aviso: AvisoDoServidor | null; valendo: boolean }>('/api/aviso')
      .then(receber)
      .catch((e) => {
        setErro((e as Error).message);
        setEstado('parado');
      });
  }, []);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setEstado('salvando');
    setErro(null);
    setSalvo(false);
    try {
      // Os campos vêm na hora local; o servidor guarda tudo em UTC, e é a conversão aqui que faz
      // "23:00" significar 23h de quem escreveu, e não 23h de Londres.
      receber(
        await api('/api/aviso', {
          method: 'PUT',
          body: {
            texto: texto.trim(),
            tom,
            de: de ? new Date(de).toISOString() : null,
            ate: ate ? new Date(ate).toISOString() : null,
            imagem,
          },
        }),
      );
      setSalvo(true);
    } catch (e) {
      setErro((e as Error).message);
      setEstado('parado');
    }
  }

  async function apagar() {
    setEstado('salvando');
    setErro(null);
    setSalvo(false);
    try {
      receber(await api('/api/aviso', { method: 'DELETE' }));
    } catch (e) {
      setErro((e as Error).message);
      setEstado('parado');
    }
  }

  if (estado === 'lendo') return <p className="settings-hint">{t('Carregando…')}</p>;

  return (
    <section className="painel-aviso">
      <h3>
        <Megaphone size={18} aria-hidden="true" /> Recado do Syden
      </h3>
      <p className="settings-hint">
        Aparece numa faixa no alto da tela de todo mundo — inclusive de quem ainda não entrou. É o jeito de avisar da
        manutenção sem precisar falar com cada amigo.
      </p>

      {existe && (
        <p className={`painel-aviso-estado${valendo ? ' valendo' : ''}`}>
          {valendo ? 'Está aparecendo para todo mundo agora.' : 'Está guardado, mas fora do horário: ninguém está vendo.'}
        </p>
      )}

      <form onSubmit={salvar}>
        <label className="campo">
          {t('O que dizer')}
          <textarea
            rows={3}
            maxLength={300}
            value={texto}
            placeholder={t('O Syden vai ficar fora do ar por uns 10 minutos para uma atualização.')}
            onChange={(e) => setTexto(e.target.value)}
          />
          <small>{300 - texto.length} letras restantes</small>
        </label>

        {/* A foto: aparece como miniatura na faixa, e clicar nela abre grande para quem vê. */}
        <div className="painel-aviso-foto">
          {imagem && <img src={previa ?? enderecoDaFotoDoAviso(imagem)} alt={t('Foto do recado')} />}
          <label className="btn-secondary">
            {subindoFoto ? t('Enviando…') : imagem ? t('Trocar a foto') : t('Pôr uma foto')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              disabled={subindoFoto}
              onChange={(e) => {
                void escolherFoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            className="link-button"
            disabled={subindoFoto}
            onClick={() => imageFromClipboard().then(escolherFoto, (e: Error) => setErro(t(e.message)))}
          >
            <ClipboardPaste size={14} aria-hidden="true" /> {t('Colar imagem')}
          </button>
          {imagem && (
            <button type="button" className="link" disabled={subindoFoto} onClick={() => {
                setImagem(null);
                setPrevia(null);
              }}>
              {t('Tirar a foto')}
            </button>
          )}
          <small className="settings-hint">{t('A foto só aparece depois de salvar o recado.')}</small>
        </div>

        <div className="painel-aviso-tons" role="radiogroup" aria-label="Tipo do recado">
          {TONS.map((opcao) => (
            <label key={opcao.id} className={`effect-option${tom === opcao.id ? ' selected' : ''}`}>
              <input type="radio" name="tom-do-aviso" checked={tom === opcao.id} onChange={() => setTom(opcao.id)} />
              <span className="effect-option-text">
                <strong>{opcao.nome}</strong>
                <small>{opcao.dica}</small>
              </span>
            </label>
          ))}
        </div>

        <div className="painel-aviso-horas">
          <label className="campo">
            {t('Começa a aparecer')}
            <input type="datetime-local" value={de} onChange={(e) => setDe(e.target.value)} />
            <small>{t('Em branco: já.')}</small>
          </label>
          <label className="campo">
            {t('Some sozinho às')}
            <input type="datetime-local" value={ate} onChange={(e) => setAte(e.target.value)} />
            <small>{t('Em branco: fica até você apagar.')}</small>
          </label>
        </div>

        <div className="painel-aviso-atalhos">
          <span>Some em:</span>
          {[
            [30, '30 min'],
            [60, '1 hora'],
            [180, '3 horas'],
            [60 * 24, 'amanhã'],
          ].map(([minutos, rotulo]) => (
            <button key={rotulo} type="button" className="btn-secondary" onClick={() => setAte(daquiA(Number(minutos)))}>
              {rotulo}
            </button>
          ))}
          {ate && (
            <button type="button" className="link" onClick={() => setAte('')}>
              limpar
            </button>
          )}
        </div>

        {erro && <p className="form-error">{erro}</p>}
        {salvo && !erro && <p className="settings-hint">Salvo.</p>}

        <div className="painel-aviso-acoes">
          <button type="submit" disabled={estado === 'salvando' || texto.trim().length < 4}>
            {existe ? 'Atualizar o recado' : 'Publicar o recado'}
          </button>
          {existe && (
            <button type="button" className="btn-secondary danger" disabled={estado === 'salvando'} onClick={() => void apagar()}>
              {t('Apagar')}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
