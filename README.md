# Syden

Um app estilo Discord para a galera: comunidades com canais de texto, salas de voz, câmera e compartilhamento
de tela.

Cada **comunidade** é um "servidor" no sentido do Discord: tem os próprios canais, membros, emojis, sons e
cargos, e entra-se nela por um código de convite. Quem cria é o dono; ele dá e tira o cargo de administrador.
Uma instalação do Syden hospeda várias comunidades, com dois freios (em `deploy/.env`) para o consumo não fugir
do controle: `MAX_COMMUNITIES_PER_USER` e `MAX_MEMBERS_PER_COMMUNITY`.

| Parte | Tecnologia | Onde roda |
|---|---|---|
| `web/` | React + Vite + LiveKit Components | GitHub Pages |
| `desktop/` | Electron (o mesmo que o Discord usa) | PC de cada pessoa (instalador `.exe`) |
| `server/` | Node 24 + Fastify + Socket.IO + SQLite | VPS na nuvem (Hetzner) |
| Mídia (voz/vídeo/tela) | [LiveKit](https://livekit.io) (SFU open source) | VPS na nuvem (Hetzner) |

Como funciona: o navegador faz login no `server`, que emite um token para a sala de voz. Com o token, o navegador
se conecta direto ao LiveKit, que recebe o áudio e o vídeo de cada pessoa uma vez e repassa para os outros
participantes da sala. O chat e o "quem está em cada sala" passam pelo Socket.IO do `server`.

## Rodar no seu PC

Pré-requisitos: Node 24 e Docker Desktop (aberto).

```bash
npm install
cp server/.env.example server/.env

npm run dev:livekit   # terminal 1: servidor de mídia (Docker)
npm run dev:server    # terminal 2: API em http://localhost:3001
npm run dev:web       # terminal 3: site em http://localhost:5173
```

Crie uma conta com o código de convite `amigos` (definido em `server/.env`). Para testar a voz sozinho, abra
duas janelas (uma delas anônima) com contas diferentes.

### Testes

```bash
npm test -w server        # 32 testes, ~5 s, sem precisar de Docker nem de porta livre
npm run typecheck -w server
```

Os testes do servidor sobem a API inteira em memória (`buildApp`), com um banco SQLite novo em pasta
temporária, e batem nas rotas de verdade com `app.inject()`. Cobrem o que quebra em silêncio: quem pode ler
o quê, o freio contra tentativa de senha, e o que derruba uma sessão. Rodam também a cada push, no
[workflow Verificar](.github/workflows/verificar.yml), junto com a compilação do site e o `npm audit`.

Os testes de ponta a ponta (`e2e/`) abrem o Syden num navegador de verdade e precisam da API e do site no ar;
veja o [e2e/LEIA.md](e2e/LEIA.md).

Para testar com alguém na mesma rede Wi-Fi, suba o LiveKit com o IP do seu PC na rede:
`LIVEKIT_NODE_IP=192.168.0.10 npm run dev:livekit`. Lembre que o navegador só libera o microfone em
`localhost` ou em HTTPS, então o teste com amigos de verdade é mais fácil já na VPS.

## Publicar

### 1. Servidor (API + LiveKit)

Qualquer VPS Linux com Docker serve. O Syden roda na **Hetzner**; a Oracle Cloud (plano grátis) também
funciona e está descrita no fim desta seção.

**Portas que precisam estar abertas para a internet:** TCP `22` (SSH), `80` e `443` (HTTPS), `7881` (mídia via
TCP) e UDP `50000-60000` (mídia).

#### Hetzner

1. Crie um servidor **Ubuntu 24.04** do tipo compartilhado (*Shared vCPU*) mais barato com 2 vCPU. Para quem
   está no Brasil, a localização com menor atraso é **Ashburn (EUA)**. Ative os **backups** (~20% a mais).
2. Cole sua chave SSH pública e crie um **firewall** com as portas acima (entrada, origem "Any").
3. Anote a franquia de tráfego do plano (coluna *Traffic*) para o `TRAFFIC_ALLOWANCE_GB` do `deploy/.env`.

#### Em qualquer provedor, depois de criar o servidor

1. Aponte dois subdomínios para o IP público, com registro DNS `A`: `api.syden.chat` e `live.syden.chat`.
   Sem domínio próprio, o [DuckDNS](https://www.duckdns.org) dá subdomínios grátis.

   > **Na Cloudflare, os dois têm que ficar em "DNS only" (nuvem cinza).** Com o proxy ligado (nuvem
   > laranja) a chamada de voz não conecta: a mídia do LiveKit é UDP, e o proxy da Cloudflare não
   > repassa UDP. O certificado continua sendo emitido pelo Caddy, como sempre.
2. No servidor:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   git clone https://github.com/<usuario>/<repo>.git janja && cd janja/deploy
   cp .env.example .env && nano .env      # preencha tudo
   sudo docker compose up -d --build
   ```
3. Confira em `https://api.syden.chat/api/health`. A resposta deve ser `{"ok":true}`.

#### Oracle Cloud "Always Free" (alternativa grátis)

Tem datacenter em São Paulo e ~10 TB de tráfego por mês, mas a configuração é mais trabalhosa.

1. Crie a conta com **Home Region: Brazil East (Sao Paulo)**. A região não muda depois, e o plano grátis só vale nela.
2. Crie primeiro a rede em **Networking → Virtual cloud networks → Start VCN Wizard → Create VCN with Internet
   Connectivity**. Criar a rede dentro da tela do servidor pode travar a opção de IP público.
3. Crie uma instância **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (2 OCPUs, 12 GB, *Always Free-eligible*), na
   subnet pública dessa rede, com IPv4 público.
4. Libere as portas na **Security List** da subnet (a 22 já vem liberada).
5. O Ubuntu da Oracle traz um firewall interno que bloqueia tudo além do SSH. Antes dos passos gerais, rode:
   ```bash
   sudo iptables -I INPUT 5 -p tcp -m multiport --dports 80,443,7881 -j ACCEPT
   sudo iptables -I INPUT 5 -p udp --dport 50000:60000 -j ACCEPT
   sudo netfilter-persistent save
   ```

A Oracle pode desligar instâncias grátis ociosas. Para evitar, converta a conta para **Pay As You Go** (os recursos
*Always Free* continuam sem custo) e crie um alerta de orçamento de US$1 em Billing → Budgets.

### 2. Site no GitHub Pages

1. Suba o repositório para o GitHub.
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → Variables**, crie `VITE_API_URL` com
   `https://api.syden.chat`.
4. Faça um push na `main` (ou rode o workflow manualmente). O site fica em `https://<usuario>.github.io/<repo>/`.
5. Confirme que `CORS_ORIGIN` no `deploy/.env` é `https://<usuario>.github.io`.

### 3. E-mail (recuperar senha e confirmar endereço)

O Syden funciona sem isto: com `RESEND_API_KEY` vazia, as mensagens vão para o registro do servidor em
vez de saírem. Mas sem envio de verdade, **quem esquece a senha perde a conta** — não há para onde mandar
o link.

1. Crie a chave em [resend.com](https://resend.com) → **API Keys**, com permissão apenas de envio
   (*Sending access*). Ela aparece uma vez só; copie na hora.
2. Em **Domains → Add Domain**, cadastre `syden.chat`. O Resend devolve três registros de DNS (um `MX` e
   dois `TXT`, para SPF e DKIM). Copie os três no painel da Cloudflare, em **DNS → Records**.
3. Espere o domínio ficar **Verified** no Resend. Costuma levar de alguns minutos a algumas horas.
4. Só então troque o remetente no `deploy/.env`:

   ```
   EMAIL_FROM=Syden <nao-responda@syden.chat>
   SITE_URL=https://endereco-do-site        # é daqui que saem os links dentro do e-mail
   ```

**Antes da verificação, o remetente de teste do Resend só entrega para o e-mail dono da conta.** Um amigo
que pedir recuperação de senha não recebe nada — e não vê erro nenhum, porque a tela nunca conta se o
endereço existe. Por isso: não anuncie a recuperação de senha antes de o domínio estar verificado.

### Saber quando algo quebra

O servidor avisa sozinho por e-mail quem administra (endereço confirmado) quando a voz cai, quando há
rajada de erros ou quando ler um arquivo começa a travar o processo. Tem um limite conhecido, e é bom
ser explícito sobre ele: **servidor morto não manda e-mail.**

Para saber que a máquina inteira caiu, é preciso alguém de fora cutucando. Configure um serviço de ping
gratuito — o [UptimeRobot](https://uptimerobot.com) leva cinco minutos — apontando para:

```
https://api.syden.chat/api/health
```

Ele responde `{"ok":true}` e não exige login, justamente para servir de sinal de vida. Peça alerta por
e-mail a cada 5 minutos de silêncio.

### 4. App de desktop (Windows)

O app é uma janela do Electron que carrega o site do GitHub Pages. Por isso, as atualizações do site chegam
para todos sem reinstalar nada. Só é preciso gerar um instalador novo quando algo muda na pasta `desktop/`.

Em relação ao navegador, o app de desktop acrescenta:
- seletor de tela e janela com miniaturas, como no Discord;
- opção de incluir o áudio do computador no compartilhamento;
- janela que vai para a bandeja ao fechar, e só uma instância aberta por vez;
- atalhos `Ctrl+R` (recarregar) e `Ctrl+Shift+I` (ferramentas de desenvolvedor).

Para testar no seu PC com o ambiente de desenvolvimento rodando: `npm run dev:desktop`.

Para publicar:

1. Crie uma tag de versão: `git tag v0.1.0 && git push --tags`.
2. O workflow **Publicar app de desktop** gera o `Syden-Setup.exe` e o anexa a uma Release do GitHub.
3. O site mostra um botão **Baixar para Windows**, na tela de login e no topo da barra lateral, que baixa sempre
   a versão mais recente. Os amigos não precisam abrir o GitHub. O link segue o formato
   `https://github.com/<usuario>/<repo>/releases/latest/download/Syden-Setup.exe`. Para usar outro, crie a
   variável `DESKTOP_DOWNLOAD_URL` no repositório. O botão só aparece no navegador do Windows (não dentro do app).
   Enquanto não existir nenhuma Release, o link dá erro 404, então publique a primeira antes de divulgar o site.
4. O app aponta sozinho para `https://<usuario>.github.io/<repo>/`. Para usar outro endereço, crie a variável
   `JANJA_URL` no repositório.

Para gerar o instalador localmente, ajuste a URL em `desktop/app.config.json` e rode `npm run dist:desktop`.
O arquivo sai em `desktop/release/`.

### Instalar pelo navegador (PWA)

O site também se instala como programa: no Edge ou no Chrome aparece **Instalar** na barra de endereço, e a tela
de login tem o botão **Instalar o Syden**. Vira uma janela própria, com ícone no menu iniciar, sem download de
instalador e sem o aviso do Windows para programas sem assinatura. Ficam de fora os atalhos globais de microfone,
o ícone na bandeja e continuar aberto em segundo plano — para isso, o instalador.

O `web/public/sw.js` existe só porque o navegador exige um service worker para oferecer a instalação; ele não
guarda nada em cache, então ninguém fica preso numa versão antiga.

O instalador não tem assinatura digital, então o Windows mostra "O Windows protegeu o computador" na primeira
vez. É só clicar em **Mais informações → Executar assim mesmo**. Para remover o aviso, é preciso um certificado
de assinatura de código, que é pago.

### Atualizar

- Site: basta dar push, o GitHub Actions publica.
- Servidor: `git pull && docker compose up -d --build` dentro de `deploy/`.
- Backup: o banco é um arquivo SQLite no volume `janja_data`.

## Painel de uso

Os administradores veem, em **Uso do servidor** (topo da barra lateral):
- o tráfego de saída do mês em relação à franquia da VPS, com a projeção para o fim do mês;
- as horas em chamada e compartilhando tela, no total e por pessoa;
- quem está em chamada agora.

Não precisa configurar nada. O próprio servidor mede os bytes enviados pela máquina (contadores do Linux) e
compara com a franquia definida em `TRAFFIC_ALLOWANCE_GB`, no `deploy/.env`. Coloque ali a franquia do seu plano;
o padrão, 10 TB, é o da Oracle. A medição começa quando o servidor é instalado; o painel avisa se ela começou no
meio do mês.

## Quanto aguenta e como escalar

O tráfego que importa é o que **sai** do LiveKit: cada stream é copiado para cada pessoa que assiste.

| Situação | Saída aproximada |
|---|---|
| 10 pessoas em voz (~40 kbps cada) | ~4 Mbps |
| 1 tela 1080p30 (até 5 Mbps) assistida por 9 | até ~45 Mbps |

Uma VPS pequena aguenta isso com folga.

### Onde está o teto, medido

O gargalo do Syden **não é a voz**: é que avatares, emojis, anexos e recados em vídeo ficam guardados
dentro do próprio banco, e o `node:sqlite` é síncrono. Enquanto o servidor lê um arquivo, o processo
inteiro para — nada de voz, nada de chat, para ninguém. `npm run medir:blobs` mede isso:

| Arquivo | Servidor travado em 1 leitura | Em 10 leituras seguidas |
|---|---|---|
| Avatar (50 KB) | 0,1 ms | 0,9 ms |
| Emoji grande (0,5 MB) | 0,7 ms | 6 ms |
| Foto (2 MB) | 3,6 ms | 28 ms |
| Clipe curto (8 MB) | 12 ms | 115 ms |
| Recado em vídeo (20 MB) | **28 ms** | **288 ms** |

Lendo assim: um recado em vídeo de 20 MB deixa o servidor surdo por ~28 ms. A voz começa a engasgar
quando isso passa de uns 50 a 100 ms, então **três ou quatro vídeos pedidos ao mesmo tempo já dão para
ouvir**. Com dez amigos nunca acontece; com cem pessoas ativas, acontece todo dia.

Quando chegar essa hora, a correção é tirar os arquivos do banco e pôr num armazenamento de objetos
(Cloudflare R2 ou S3), com o navegador baixando direto de lá. Enquanto o número da tabela acima não
incomodar ninguém, mexer nisso é trabalho sem retorno — e é por isso que ainda não foi feito.

Caminho para crescer, na ordem:

1. **VPS maior.** Um único LiveKit aguenta centenas de participantes.
2. **Vários LiveKit.** Com Redis, o LiveKit distribui as salas entre várias máquinas (`redis:` no `livekit.yaml`).
3. **Vários `server`.** Trocar SQLite por Postgres, usar `@socket.io/redis-adapter` e mover o estado de voz em
   memória (`server/src/realtime.ts`) para o Redis.
