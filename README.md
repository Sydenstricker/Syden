# Janja

Um app estilo Discord para a galera: canais de texto, salas de voz, câmera e compartilhamento de tela.

| Parte | Tecnologia | Onde roda |
|---|---|---|
| `web/` | React + Vite + LiveKit Components | GitHub Pages |
| `desktop/` | Electron (o mesmo que o Discord usa) | PC de cada pessoa (instalador `.exe`) |
| `server/` | Node 24 + Fastify + Socket.IO + SQLite | Servidor na nuvem (Oracle Cloud, grátis) |
| Mídia (voz/vídeo/tela) | [LiveKit](https://livekit.io) (SFU open source) | Servidor na nuvem (Oracle Cloud, grátis) |

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

Para testar com alguém na mesma rede Wi-Fi, suba o LiveKit com o IP do seu PC na rede:
`LIVEKIT_NODE_IP=192.168.0.10 npm run dev:livekit`. Lembre que o navegador só libera o microfone em
`localhost` ou em HTTPS, então o teste com amigos de verdade é mais fácil já na VPS.

## Publicar

### 1. Servidor na Oracle Cloud "Always Free" (API + LiveKit)

O plano grátis da Oracle tem datacenter em São Paulo e inclui ~10 TB de tráfego de saída por mês. Qualquer VPS
Linux com Docker serve; os passos abaixo são os da Oracle.

1. Crie a conta com **Home Region: Brazil East (Sao Paulo)**. A região não pode ser trocada depois, e o plano
   grátis só vale nela.
2. Crie uma instância **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (Ampere/ARM), com 2 OCPUs e 12 GB. Ela
   precisa aparecer como *Always Free-eligible*. Cole sua chave SSH pública e mantenha o IPv4 público ligado.
3. Libere as portas na **Security List** da subnet (Ingress, Source `0.0.0.0/0`): TCP `80`, `443` e `7881`, e
   UDP `50000-60000`. A porta 22 (SSH) já vem liberada.
4. Aponte dois domínios para o IP público (registro DNS `A`), por exemplo `api.seudominio.com` e
   `live.seudominio.com`. Sem domínio próprio, o [DuckDNS](https://www.duckdns.org) dá subdomínios grátis.
5. Na instância (usuário `ubuntu`). O Ubuntu da Oracle traz um firewall interno que bloqueia tudo além do SSH,
   então as duas primeiras linhas liberam as mesmas portas:
   ```bash
   sudo iptables -I INPUT 5 -p tcp -m multiport --dports 80,443,7881 -j ACCEPT
   sudo iptables -I INPUT 5 -p udp --dport 50000:60000 -j ACCEPT
   sudo netfilter-persistent save
   curl -fsSL https://get.docker.com | sudo sh
   git clone https://github.com/<usuario>/<repo>.git janja && cd janja/deploy
   cp .env.example .env && nano .env      # preencha tudo
   sudo docker compose up -d --build
   ```
6. Confira em `https://api.seudominio.com/api/health`. A resposta deve ser `{"ok":true}`.

A Oracle pode desligar instâncias grátis que ficam ociosas por muito tempo. Para evitar isso, converta a conta
para **Pay As You Go**: os recursos *Always Free* continuam sem custo. Nesse caso, crie um alerta de orçamento
(Billing → Budgets) de US$1 para ser avisado se algo pago for criado por engano.

### 2. Site no GitHub Pages

1. Suba o repositório para o GitHub.
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → Variables**, crie `VITE_API_URL` com
   `https://api.seudominio.com`.
4. Faça um push na `main` (ou rode o workflow manualmente). O site fica em `https://<usuario>.github.io/<repo>/`.
5. Confirme que `CORS_ORIGIN` no `deploy/.env` é `https://<usuario>.github.io`.

### 3. App de desktop (Windows)

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
2. O workflow **Publicar app de desktop** gera o `Janja-Setup.exe` e o anexa a uma Release do GitHub.
3. O site mostra um botão **Baixar para Windows**, na tela de login e no topo da barra lateral, que baixa sempre
   a versão mais recente. Os amigos não precisam abrir o GitHub. O link segue o formato
   `https://github.com/<usuario>/<repo>/releases/latest/download/Janja-Setup.exe`. Para usar outro, crie a
   variável `DESKTOP_DOWNLOAD_URL` no repositório. O botão só aparece no navegador do Windows (não dentro do app).
   Enquanto não existir nenhuma Release, o link dá erro 404, então publique a primeira antes de divulgar o site.
4. O app aponta sozinho para `https://<usuario>.github.io/<repo>/`. Para usar outro endereço, crie a variável
   `JANJA_URL` no repositório.

Para gerar o instalador localmente, ajuste a URL em `desktop/app.config.json` e rode `npm run dist:desktop`.
O arquivo sai em `desktop/release/`.

O instalador não tem assinatura digital, então o Windows mostra "O Windows protegeu o computador" na primeira
vez. É só clicar em **Mais informações → Executar assim mesmo**. Para remover o aviso, é preciso um certificado
de assinatura de código, que é pago.

### Atualizar

- Site: basta dar push, o GitHub Actions publica.
- Servidor: `git pull && docker compose up -d --build` dentro de `deploy/`.
- Backup: o banco é um arquivo SQLite no volume `janja_data`.

## Painel de uso

Todos os usuários veem, em **Uso do servidor** (topo da barra lateral):
- o tráfego de saída do mês em relação à franquia da VPS, com a projeção para o fim do mês;
- as horas em chamada e compartilhando tela, no total e por pessoa;
- quem está em chamada agora.

Não precisa configurar nada. O próprio servidor mede os bytes enviados pela máquina (contadores do Linux) e
compara com a franquia, que por padrão é de 10 TB (a do plano grátis da Oracle). Em outro provedor, ajuste
`TRAFFIC_ALLOWANCE_GB` no `deploy/.env`. A medição começa quando o servidor é instalado; o painel avisa se ela
começou no meio do mês.

## Quanto aguenta e como escalar

O tráfego que importa é o que **sai** do LiveKit: cada stream é copiado para cada pessoa que assiste.

| Situação | Saída aproximada |
|---|---|
| 10 pessoas em voz (~40 kbps cada) | ~4 Mbps |
| 1 tela 1080p30 (~3 Mbps) assistida por 9 | ~27 Mbps |

Uma VPS pequena aguenta isso com folga. Caminho para crescer, na ordem:

1. **VPS maior.** Um único LiveKit aguenta centenas de participantes.
2. **Vários LiveKit.** Com Redis, o LiveKit distribui as salas entre várias máquinas (`redis:` no `livekit.yaml`).
3. **Vários `server`.** Trocar SQLite por Postgres, usar `@socket.io/redis-adapter` e mover o estado de voz em
   memória (`server/src/realtime.ts`) para o Redis.
