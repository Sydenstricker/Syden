# O site na Hetzner: tirar o GitHub Pages do caminho

**Plano escrito em 12/11/2026, a pedido dele.** Ainda NÃO foi feito. Cada etapa é reversível, e o site antigo continua
no ar até a última.

## Por que

Hoje, quem abre o Syden passa por dois serviços de fora antes de chegar no site: a **Cloudflare** (a porta de entrada
de syden.chat) e o **GitHub Pages** (que guarda e entrega os arquivos). Se qualquer um cai, o Syden não abre, mesmo com
o nosso servidor inteiro funcionando. Aconteceu em 11/11/2026, das 17:48 às 18:07: o Pages caiu, e o site com ele.

**A decisão (dele, 12/11/2026):** o site passa a morar no **nosso servidor na Hetzner**, servido pelo Caddy que já está
lá, com a **Cloudflare na frente como cache**, como hoje. Uma reserva automática no Cloudflare Pages foi avaliada e
ficou de fora: o site sem a Hetzner não faz nada (a API e a voz moram lá), então a reserva só mostraria a tela de erro
com o coelho, e custaria uma troca automática e dois lugares para publicar.

**O que melhora:**
- **O GitHub sai do funcionamento.** Continua só para montar o site no deploy (o GitHub Actions).
- **Os cabeçalhos do site** (a política de segurança, o "pode abrir em quadro") saem da regra escrita à mão no painel da
  Cloudflare e passam a viver no repositório, no Caddyfile, conferidos pelo CI. Hoje cada site de jogo novo que roda
  dentro do Syden pede mexer à mão no painel.
- **As versões antigas ficam no servidor** por um tempo: quem está com a página aberta durante um deploy continua achando
  os arquivos da versão dele. No Pages, eles somem na hora (o `VersaoNova.tsx` recarrega a página, mas é um recarregar
  que dá para evitar).

**O peso, revisto no mesmo dia:** ganho moderado e nada urgente (o Pages caiu uma vez, 19 min, em dois meses; o
`conferir-csp.mjs` já protege os cabeçalhos). Fica escrito para quando houver motivo. Publicar o site já não reinicia
a API hoje, então isso não é vantagem da troca.

**O que não muda, para não haver ilusão:** o filtro de 300 arquivos do deploy é do GitHub Actions (o filtro por pasta
de um push grande), e continua; a saída segue sendo rodar o deploy à mão pelo "Run workflow". E a Cloudflare continua
no caminho: se ela cair, o Syden não abre, como hoje.

**O preço:**
- Tudo depende de uma máquina só. Na prática já é assim: sem a Hetzner, o Syden não funciona.
- Os arquivos passam a sair da Alemanha quando a Cloudflare não os tem guardados. Os do app têm a impressão digital
  no nome (o nome muda quando o conteúdo muda), então a Cloudflare os guarda em São Paulo e no Rio e quase ninguém baixa
  da Alemanha. A página HTML em si é pequena e sai sempre do servidor (~200 ms a mais na primeira resposta).
- Um usuário novo no servidor, com uma chave que só sabe receber o site, e um script nosso para trocar a versão.

## O cuidado que não se pula

**O site fora do ar é o Syden fora do ar.** Por isso: o site novo é testado primeiro num endereço de TESTE
(novo.syden.chat), sem tocar em syden.chat; o deploy publica nos DOIS lugares por uns dias; e a troca de syden.chat é
uma mudança de DNS na Cloudflare, que se desfaz em segundos (com o proxy ligado, a mudança vale na hora para todo mundo,
sem esperar cache de DNS).

**Antes de mexer no DNS, anotar o que está lá** (etapa 0). Desfazer é voltar exatamente para aquilo.

## As etapas (uma por vez; cola-se o resultado de cada uma antes da próxima)

### Etapa 0 — anotar como está, e o certificado de origem

1. **Anotar o DNS de hoje.** No painel da Cloudflare → syden.chat → DNS → Records: tirar uma foto da tela com todos os
   registros de `syden.chat` e `www` (hoje eles apontam para o GitHub Pages: quatro `A` 185.199.108–111.153, ou um
   `CNAME` para sydenstricker.github.io). É essa foto que desfaz a troca.
2. **Conferir o modo SSL.** SSL/TLS → Overview: anotar qual está marcado (Flexible, Full ou Full (strict)). Ao fim, o
   certo é **Full (strict)**.
3. **Criar o certificado de origem.** SSL/TLS → Origin Server → Create Certificate: deixar "Generate private key and CSR
   with Cloudflare", os nomes `syden.chat` e `*.syden.chat`, validade 15 anos. Ele mostra o **certificado** e a **chave
   privada**: guardar os dois (a chave só aparece UMA vez).

   **Por que este e não o Let's Encrypt, que o Caddy já usa na API:** com a Cloudflare na frente (nuvem laranja), o Let's
   Encrypt não consegue conferir que o servidor é dono de syden.chat do jeito que o Caddy faz sozinho, e o certificado
   não sai. O de origem é emitido pela própria Cloudflare, vale 15 anos e só é aceito por ela. É exatamente o caso: o
   site só é aberto através dela. A API e o LiveKit continuam com o Let's Encrypt de sempre (são nuvem cinza, sem proxy).

### Etapa 1 — o lugar do site no servidor, e quem pode publicar nele

1. **Pôr o certificado no servidor** (SSH como root):

```bash
mkdir -p /srv/syden-site/certificado /srv/syden-site/versoes
nano /srv/syden-site/certificado/origem.pem    # colar o certificado
nano /srv/syden-site/certificado/origem.key    # colar a chave privada
chmod 600 /srv/syden-site/certificado/origem.key
```

2. **O usuário que publica.** Ele não entra no servidor: a chave dele só roda um comando, o que recebe o site
   (`deploy/receber-site.sh`, que entra no repositório nesta etapa: lê um `.tar.gz` da entrada, abre numa pasta nova
   em `versoes/`, confere que tem `index.html` e `app/index.html`, troca o atalho `atual` para ela de uma vez só, e
   guarda as 5 últimas versões).

```bash
adduser --system --group --home /srv/syden-site site
chown -R site:site /srv/syden-site/versoes
install -m 755 /root/Syden/deploy/receber-site.sh /usr/local/bin/receber-site
```

3. **A chave do deploy**, gerada no PC dele, só para isto (sem senha, porque quem a usa é o GitHub Actions):

```powershell
ssh-keygen -t ed25519 -N '""' -C "deploy do site" -f $env:USERPROFILE\.ssh\syden-site
```

   No servidor, ela entra amarrada ao comando, sem terminal, sem túnel, sem nada além de receber o site:

```bash
mkdir -p /srv/syden-site/.ssh
echo 'command="/usr/local/bin/receber-site",restrict ssh-ed25519 AAAA...(o conteúdo de syden-site.pub)' > /srv/syden-site/.ssh/authorized_keys
chown -R site:site /srv/syden-site/.ssh && chmod 700 /srv/syden-site/.ssh && chmod 600 /srv/syden-site/.ssh/authorized_keys
```

   Mesmo se a chave vazar, quem a tiver só consegue trocar o site, e as versões anteriores ficam lá para voltar. Ela
   convive com o plano do SSH só com chave (`docs/ssh-so-com-chave.md`): é uma chave, e de um usuário que não é o root.

4. **Testar do PC**, com o site montado localmente (`npm run build -w web`):

```bash
tar -czf - -C web/dist . | ssh -i ~/.ssh/syden-site site@2.28.78.99
```

   Deve responder com o nome da versão. No servidor, `ls -l /srv/syden-site/` mostra `atual -> versoes/<data>`.

**Para desfazer:** `deluser site`, apagar `/srv/syden-site`. Nada do que está no ar foi tocado.

### Etapa 2 — o Caddy serve o site num endereço de teste

1. **No repositório** (preparo o código nesta etapa): o `Caddyfile` ganha o bloco do site em `{$SITE_DOMAIN}`, com:
   - o certificado de origem (`tls /srv/syden-site/certificado/origem.pem /srv/syden-site/certificado/origem.key`);
   - os arquivos de `/srv/syden-site/atual`, e o mesmo que o Pages faz sozinho: `/contribuir` acha `contribuir.html`,
     uma pasta acha o `index.html` dela, e o que não existe recebe o `404.html` com o código 404;
   - os cabeçalhos de segurança, gerados de `e2e/politica-de-seguranca.mjs` (a mesma fonte que o `conferir-csp.mjs` já
     usa) num arquivo que o Caddyfile importa, com um teste no CI que falha se os dois divergirem;
   - o tempo de guarda: um ano e "imutável" para o que tem impressão digital no nome (`/app/assets/`), e 30 s para o HTML,
     como hoje.

   O `docker-compose.yml` monta `/srv/syden-site` no Caddy (só leitura) e passa `SITE_DOMAIN` do `.env`.
2. **No servidor:** `SITE_DOMAIN=novo.syden.chat` no `.env`, e `docker compose up -d caddy` (recarrega só o Caddy: a API e
   a voz não piscam).
3. **Na Cloudflare:** um registro `A` `novo` → `2.28.78.99`, **com o proxy ligado** (nuvem laranja).
4. **Conferir:** abrir https://novo.syden.chat/ e /app/, e rodar:

```bash
SITE=https://novo.syden.chat node e2e/cenas-no-ar.mjs
SITE_CSP=https://novo.syden.chat/app/ node scripts/conferir-csp.mjs
```

   **Entrar na conta pelo endereço de teste pede uma linha a mais na API** (`CORS_ORIGIN` com `https://novo.syden.chat`
   no `.env`, e reiniciar a API, de madrugada). Dá para pular: o site abrir, os cabeçalhos baterem e o quarto aparecer já
   provam o Caddy. A entrada com Google, Discord e afins só volta para syden.chat e não se testa aqui.

**Para desfazer:** apagar o registro `novo` na Cloudflare e tirar `SITE_DOMAIN` do `.env`. syden.chat nem soube.

### Etapa 3 — o deploy publica nos dois lugares

O `deploy-web.yml` ganha um passo depois do build: o mesmo `tar … | ssh` da etapa 1, com a chave guardada em Settings →
Secrets and variables → Actions → **Secrets** → `SITE_SSH_KEY` (o conteúdo de `syden-site`, a parte privada) e a
impressão do servidor em `SITE_SSH_KNOWN_HOSTS` (a saída de `ssh-keyscan 2.28.78.99`, para o Actions não aceitar um
servidor falso). O GitHub Pages continua recebendo também.

Rodar assim por **uns 3 dias de uso normal**, conferindo de vez em quando que os dois mostram a mesma versão (o nome do
arquivo principal do app muda a cada versão):

```bash
for s in syden.chat novo.syden.chat; do curl -s https://$s/app/ | grep -o 'assets/index-[^"]*\.js' | head -1; done
```

**Para desfazer:** tirar o passo do workflow. O Pages nunca deixou de receber.

### Etapa 4 — a troca de syden.chat (de madrugada)

1. **No servidor:** `SITE_DOMAIN=syden.chat` no `.env` (e `novo.syden.chat` junto, separado por vírgula, se quiser manter o
   de teste por mais uns dias), e `docker compose up -d caddy`.
2. **Na Cloudflare → DNS:** trocar os registros de `syden.chat` (os do GitHub da foto da etapa 0) por um `A` `@` →
   `2.28.78.99`, com o proxy ligado. O `www` continua como está (hoje ele já responde com um redirecionamento para syden.chat; conferir que continua).
3. **SSL/TLS → Overview → Full (strict).**
4. **A regra de cabeçalhos da Cloudflare (Transform Rule) FICA por enquanto.** Ela sobrescreve os do Caddy, e os dois são
   iguais: não há como dar briga. Sai na etapa 5.
5. **Conferir na hora:**

```bash
curl -sI https://syden.chat/app/ | grep -i "content-security\|cache-control\|x-frame"
node e2e/cenas-no-ar.mjs
node scripts/conferir-csp.mjs
```

   E abrir o Syden no navegador e no app, entrar, abrir o quarto, o salão e um jogo.

**Para desfazer (segundos):** na Cloudflare, voltar os registros de `syden.chat` para os da foto da etapa 0. O Pages
continua recebendo cada deploy desde a etapa 3, então volta na versão certa.

### Etapa 5 — uma semana depois, desligar o que ficou para trás

Só se a semana passou sem problema:
- tirar o job do Pages do `deploy-web.yml` (e desligar o Pages em Settings → Pages);
- apagar a Transform Rule de cabeçalhos da Cloudflare (o `conferir-csp.mjs` continua conferindo o ar, agora contra o
  Caddy);
- apagar o registro `novo` e, se foi posto, o `novo.syden.chat` do `CORS_ORIGIN`;
- atualizar o CLAUDE.md onde ele diz que o site está no GitHub Pages e que os cabeçalhos são postos à mão na Cloudflare
  ("o iframe depende de três cabeçalhos da Cloudflare", e o "E a Cloudflare, à mão" dos jogos de parceiro).

## Depois (não faz parte deste plano)

- **A página de erro quando a Hetzner cair.** A Cloudflare mostra a dela (521/522). Uma nossa, com o coelho e o recado,
  pede um Worker (grátis até 100 mil acessos por dia) ou o plano pago dela. Só vale se as quedas virarem assunto.
- **Aceitar no servidor só quem vem da Cloudflare** nas portas 80 e 443 do site, para ninguém pular o cache e bater direto
  no servidor. A API e o LiveKit não entram nisso (são nuvem cinza).
