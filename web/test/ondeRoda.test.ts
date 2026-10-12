import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ondeRoda } from '../src/ondeRoda';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const EDGE = CHROME + ' Edg/154.0.0.0';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const APP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Syden/0.1.7 Chrome/140.0.0.0 Electron/38.0.0 Safari/537.36';

describe('onde o Syden roda, para o diário de saúde', () => {
  it('reconhece os navegadores, com o Edge antes do Chrome que ele também diz ser', () => {
    assert.equal(ondeRoda(CHROME, false), 'Chrome 154');
    assert.equal(ondeRoda(EDGE, false), 'Edge 154');
    assert.equal(ondeRoda(FIREFOX, false), 'Firefox 131');
    assert.equal(ondeRoda(SAFARI, false), 'Safari 18');
  });

  it('no app diz "app" e a versão, mesmo com o Chrome de dentro do Electron no texto', () => {
    assert.equal(ondeRoda(APP, true), 'app 0.1.7');
    assert.equal(ondeRoda(CHROME, true), 'app');
  });

  it('o que não reconhece vira só "navegador"', () => {
    assert.equal(ondeRoda('algo estranho', false), 'navegador');
  });
});
