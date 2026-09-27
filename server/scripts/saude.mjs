// O Docker pergunta, de tempo em tempo, se este servidor está vivo. Este arquivo é a resposta.
//
// Sai com 0 quando o servidor responde, e com 1 quando não. O Docker marca o container como "healthy"
// ou "unhealthy" a partir disso — e é o que faz `docker compose up -d --wait` só devolver o terminal
// depois que o servidor NOVO estiver respondendo de verdade.
//
// Por que um arquivo em vez de um comando na linha do compose: a imagem é `node:slim`, que não tem curl
// nem wget. O que ela tem é o Node — e um arquivo evita escrever JavaScript dentro de YAML, que é onde
// aspas viram armadilha.
const PORTA = process.env.PORT || 3001;

// Curto de propósito: o que se quer saber é se o servidor atende, não se ele atende com calma. Um
// servidor que demora três segundos para dizer "ok" está com problema, e é bom que isso apareça.
const resposta = await fetch(`http://localhost:${PORTA}/api/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);

process.exit(resposta?.ok ? 0 : 1);
