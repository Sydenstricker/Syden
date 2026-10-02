// A tela de sem conexão: texto, idioma e o botão de tentar de novo.
//
// POR QUE ELA TEM UM DICIONÁRIO PRÓPRIO, em vez de usar o do Syden. Porque o i18n mora no site, e esta
// é a única tela do app que aparece justamente quando o site não pode ser buscado. Se houvesse internet
// para carregar a tradução, não haveria tela de sem conexão.
//
// SÃO CINCO FRASES, NOS MESMOS IDIOMAS DO SYDEN. Por muito tempo foram três idiomas, enquanto o app
// tinha dezessete — e o resultado era o pior possível para quem fala coreano: o Syden inteiro em
// coreano, e a única tela que aparece quando algo dá errado, em português. Quem está sem internet é
// justamente quem menos pode procurar tradução em outro lugar.
//
// O QUE ESTA TELA NÃO FAZ: pedir fonte. O desenho de cada escrita vem do Windows (Segoe UI para o
// árabe, Nirmala UI para o híndi e o bengali, Malgun Gothic para o coreano, Microsoft YaHei para o
// chinês), porque buscar a Noto do Google exigiria a internet que não existe. É também o que a
// política de segurança da página permite: `default-src 'none'`.

const TEXTOS = {
  pt: {
    titulo: 'Não foi possível conectar',
    explicacao: 'Verifique sua internet. O servidor também pode estar fora do ar.',
    botao: 'Tentar de novo',
    tentando: 'Tentando…',
    codigo: 'OFFLINE — Sem conexão',
  },
  en: {
    titulo: "Couldn't connect",
    explicacao: 'Check your internet. The server may also be down.',
    botao: 'Try again',
    tentando: 'Trying…',
    codigo: 'OFFLINE — No connection',
  },
  es: {
    titulo: 'No fue posible conectar',
    explicacao: 'Revisa tu internet. El servidor también puede estar caído.',
    botao: 'Intentar de nuevo',
    tentando: 'Intentando…',
    codigo: 'OFFLINE — Sin conexión',
  },
  fr: {
    titulo: 'Connexion impossible',
    explicacao: 'Vérifie ta connexion. Le serveur peut aussi être hors service.',
    botao: 'Réessayer',
    tentando: 'Tentative…',
    codigo: 'OFFLINE — Pas de connexion',
  },
  de: {
    titulo: 'Verbindung nicht möglich',
    explicacao: 'Prüf deine Internetverbindung. Der Server kann auch gerade aus sein.',
    botao: 'Nochmal versuchen',
    tentando: 'Versuche…',
    codigo: 'OFFLINE — Keine Verbindung',
  },
  it: {
    titulo: 'Impossibile connettersi',
    explicacao: 'Controlla la tua connessione. Anche il server potrebbe essere giù.',
    botao: 'Riprova',
    tentando: 'Sto provando…',
    codigo: 'OFFLINE — Nessuna connessione',
  },
  nl: {
    titulo: 'Verbinden lukt niet',
    explicacao: 'Check je internet. De server kan ook plat liggen.',
    botao: 'Opnieuw proberen',
    tentando: 'Bezig…',
    codigo: 'OFFLINE — Geen verbinding',
  },
  ru: {
    titulo: 'Не удалось подключиться',
    explicacao: 'Проверь интернет. Сервер тоже может быть недоступен.',
    botao: 'Попробовать снова',
    tentando: 'Пробуем…',
    codigo: 'OFFLINE — Нет соединения',
  },
  tr: {
    titulo: 'Bağlanılamadı',
    explicacao: 'İnternetini kontrol et. Sunucu da kapalı olabilir.',
    botao: 'Tekrar dene',
    tentando: 'Deneniyor…',
    codigo: 'OFFLINE — Bağlantı yok',
  },
  sw: {
    titulo: 'Haikuwezekana kuunganisha',
    explicacao: 'Angalia intaneti yako. Seva pia inaweza kuwa imezimika.',
    botao: 'Jaribu tena',
    tentando: 'Inajaribu…',
    codigo: 'OFFLINE — Hakuna muunganisho',
  },
  // Malaio e indonésio são línguas próximas com normas OPOSTAS de tratamento: em malaio "anda" é o
  // neutro e "kamu" soa grosseiro entre desconhecidos; em indonésio é o contrário.
  ms: {
    titulo: 'Tidak dapat menyambung',
    explicacao: 'Periksa internet anda. Pelayan juga mungkin tidak berfungsi.',
    botao: 'Cuba lagi',
    tentando: 'Mencuba…',
    codigo: 'OFFLINE — Tiada sambungan',
  },
  id: {
    titulo: 'Tidak bisa terhubung',
    explicacao: 'Cek internet kamu. Server juga bisa saja sedang mati.',
    botao: 'Coba lagi',
    tentando: 'Mencoba…',
    codigo: 'OFFLINE — Tidak ada koneksi',
  },
  zh: {
    titulo: '无法连接',
    explicacao: '检查一下你的网络。服务器也可能暂时不可用。',
    botao: '重试',
    tentando: '正在重试…',
    codigo: 'OFFLINE — 没有连接',
  },
  ko: {
    titulo: '연결할 수 없어요',
    explicacao: '인터넷을 확인해 보세요. 서버가 꺼져 있을 수도 있어요.',
    botao: '다시 시도',
    tentando: '시도 중…',
    codigo: 'OFFLINE — 연결 없음',
  },
  hi: {
    titulo: 'कनेक्ट नहीं हो पाया',
    explicacao: 'अपना इंटरनेट देखो। सर्वर भी बंद हो सकता है।',
    botao: 'फिर से कोशिश करो',
    tentando: 'कोशिश हो रही है…',
    codigo: 'OFFLINE — कोई कनेक्शन नहीं',
  },
  bn: {
    titulo: 'সংযোগ করা গেল না',
    explicacao: 'তোমার ইন্টারনেট দেখো। সার্ভারও বন্ধ থাকতে পারে।',
    botao: 'আবার চেষ্টা করো',
    tentando: 'চেষ্টা করছি…',
    codigo: 'OFFLINE — সংযোগ নেই',
  },
  vi: {
    titulo: 'Không kết nối được',
    explicacao: 'Hãy xem lại mạng của bạn. Cũng có thể máy chủ đang tắt.',
    botao: 'Thử lại',
    tentando: 'Đang thử…',
    codigo: 'OFFLINE — không có kết nối',
  },
  ta: {
    titulo: 'இணைக்க முடியவில்லை',
    explicacao: 'உங்கள் இணையத்தைப் பாருங்கள். சேவையகமும் நின்றிருக்கலாம்.',
    botao: 'மீண்டும் முயல்',
    tentando: 'முயல்கிறது…',
    codigo: 'OFFLINE — இணைப்பு இல்லை',
  },
  te: {
    titulo: 'కనెక్ట్ కాలేదు',
    explicacao: 'మీ ఇంటర్నెట్ చూడండి. సర్వర్ కూడా ఆగి ఉండవచ్చు.',
    botao: 'మళ్ళీ ప్రయత్నించు',
    tentando: 'ప్రయత్నిస్తోంది…',
    codigo: 'OFFLINE — కనెక్షన్ లేదు',
  },
  ja: {
    titulo: '接続できません',
    explicacao: 'インターネットを確認してください。サーバーが止まっていることもあります。',
    botao: 'もう一度試す',
    tentando: '試しています…',
    codigo: 'OFFLINE — 接続なし',
  },
  fa: {
    titulo: 'ارتباط برقرار نشد',
    explicacao: 'اینترنتتان را ببینید. ممکن است سرور هم خاموش باشد.',
    botao: 'تلاش دوباره',
    tentando: 'در حال تلاش…',
    codigo: 'OFFLINE — بدون ارتباط',
  },
  ur: {
    titulo: 'رابطہ نہیں ہو سکا',
    explicacao: 'اپنا انٹرنیٹ دیکھ لیں۔ ہو سکتا ہے سرور بھی بند ہو۔',
    botao: 'دوبارہ کوشش کریں',
    tentando: 'کوشش ہو رہی ہے…',
    codigo: 'OFFLINE — کوئی رابطہ نہیں',
  },
  ar: {
    titulo: 'تعذّر الاتصال',
    explicacao: 'تحقّق من الإنترنت لديك. قد يكون الخادم متوقفًا أيضًا.',
    botao: 'حاول مرة أخرى',
    tentando: 'جارٍ المحاولة…',
    codigo: 'OFFLINE — لا يوجد اتصال',
  },
  ha: {
    titulo: 'Ba a iya haɗawa ba',
    explicacao: 'Ku duba intanet ɗinku. Mai yiwuwa sabar ma ta tsaya.',
    botao: 'Sake gwadawa',
    tentando: 'Ana gwadawa…',
    codigo: 'OFFLINE — babu haɗi',
  },
};

/** Quem escreve da direita para a esquerda. Hoje é só o árabe; o dia que entrar hebraico ou persa, aqui. */
const DA_DIREITA_PARA_A_ESQUERDA = new Set(['ar', 'ur', 'fa']);

/**
 * O idioma, pela raiz do que o sistema informa.
 *
 * Só a raiz ("pt" de "pt-BR") porque não há variantes aqui: um português é um português, e o chinês do
 * Syden é "zh-CN" mas entra nesta lista como "zh". E o que não estiver na lista cai em português, como
 * no resto do Syden.
 *
 * ESTA TELA NÃO LÊ A ESCOLHA FEITA DENTRO DO SYDEN, e não é descuido: a escolha mora no
 * localStorage do SITE, e esta página é um arquivo local, de outra origem. O navegador não deixa um
 * ler o armazenamento do outro — é a mesma regra que impede qualquer página de ler a de um banco. Então
 * o que sobra é o idioma do sistema, que é também o que o Syden usa antes de alguém escolher.
 */
function idioma() {
  const bruto = (navigator.language || 'pt').toLowerCase().split('-')[0];
  return TEXTOS[bruto] ? bruto : 'pt';
}

const codigo = idioma();
const t = TEXTOS[codigo];
document.documentElement.lang = codigo;
document.documentElement.dir = DA_DIREITA_PARA_A_ESQUERDA.has(codigo) ? 'rtl' : 'ltr';
document.getElementById('titulo').textContent = t.titulo;
document.getElementById('explicacao').textContent = t.explicacao;
document.getElementById('codigo').textContent = t.codigo;

const botao = document.getElementById('retry');
botao.textContent = t.botao;

const destino = new URLSearchParams(location.search).get('url');

botao.addEventListener('click', () => {
  if (!destino) return;
  // O botão se desliga durante a tentativa. Sem isto, quem clica três vezes seguidas dispara três
  // navegações, e a terceira cancela a primeira — o que parece que o botão não funciona.
  botao.disabled = true;
  botao.textContent = t.tentando;
  location.href = destino;
});
