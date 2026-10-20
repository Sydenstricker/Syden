// Captura o som do computador MENOS o do próprio Syden — ou, quando a transmissão é de uma janela, SÓ o do
// programa dono dela.
//
// O Windows não deixa um programa gravar o som de outro, mas desde a versão 2004 ele oferece o contrário:
// "me dê tudo o que está tocando, exceto esta árvore de processos". Apontando essa exceção para o próprio
// Syden, sobra o que a pessoa quer transmitir — o jogo, o vídeo, o navegador — sem as vozes de quem está
// na chamada, que é o eco que incomodava todo mundo.
//
// O caminho é o WASAPI: ativa-se um cliente de áudio "virtual" (VAD\Process_Loopback) passando o processo
// a excluir (ou a incluir), e a partir daí a leitura é igual à de um microfone qualquer. Os pedaços de som saem daqui
// para o JavaScript por uma função segura entre threads.

#include <napi.h>

// A faixa de idade que o Windows informa (idade.cpp).
Napi::Value FaixaDeIdade(const Napi::CallbackInfo& info);

#include <windows.h>
#include <objidl.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>

#include <atomic>
#include <cstdint>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace {

/**
 * Espera a ativação do cliente de áudio, que o Windows faz em outra thread.
 *
 * MORA NO HEAP, COM CONTAGEM DE REFERÊNCIAS DE VERDADE (auditoria do áudio, 17/10/2026). Antes ele vivia na pilha da
 * thread de captura: se a ativação passasse do prazo, a função voltava, a pilha sumia, e o Windows ainda guardava o
 * ponteiro — quando a ativação terminasse, o ActivateCompleted escreveria em memória já liberada, e quem cai é o
 * processo principal do app. Agora cada lado (a captura e o Windows) segura a sua referência, e o último a soltar apaga.
 *
 * O IAgileObject a mais não é decoração: sem ele o Windows recusa a chamada com E_ILLEGAL_METHOD_CALL e
 * não diz por quê. É a forma de avisar que este objeto pode ser usado de qualquer thread, o que o
 * sistema exige de quem recebe o aviso de "ativação terminada".
 */
class ActivationHandler : public IActivateAudioInterfaceCompletionHandler, public IAgileObject {
 public:
  ActivationHandler() : done_(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {}

  HRESULT STDMETHODCALLTYPE ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation) override {
    IUnknown* unknown = nullptr;
    activation_result_ = operation->GetActivateResult(&result_, &unknown);
    if (SUCCEEDED(activation_result_) && SUCCEEDED(result_) && unknown) {
      unknown->QueryInterface(__uuidof(IAudioClient), reinterpret_cast<void**>(&client_));
      unknown->Release();
    }
    SetEvent(done_);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** object) override {
    if (riid == __uuidof(IUnknown) || riid == __uuidof(IActivateAudioInterfaceCompletionHandler)) {
      *object = static_cast<IActivateAudioInterfaceCompletionHandler*>(this);
      AddRef();
      return S_OK;
    }
    if (riid == __uuidof(IAgileObject)) {
      *object = static_cast<IAgileObject*>(this);
      AddRef();
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }
  ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG left = --refs_;
    if (left == 0) delete this;
    return left;
  }

  /**
   * Espera o Windows terminar a ativação; devolve o cliente de áudio (que passa a ser de quem chamou) ou nulo.
   * Passado o prazo, o cliente não é tocado: o Windows ainda pode estar escrevendo nele, e quem o solta é o destrutor.
   */
  IAudioClient* Wait(DWORD timeout_ms) {
    if (WaitForSingleObject(done_, timeout_ms) != WAIT_OBJECT_0) {
      timed_out_ = true;
      return nullptr;
    }
    IAudioClient* client = client_;
    client_ = nullptr;
    if (SUCCEEDED(activation_result_) && SUCCEEDED(result_)) return client;
    if (client) client->Release();
    return nullptr;
  }

  HRESULT error() const {
    if (timed_out_) return HRESULT_FROM_WIN32(WAIT_TIMEOUT);
    return FAILED(activation_result_) ? activation_result_ : result_;
  }

 private:
  // Privado: só o Release apaga (ninguém deve destruir o objeto com o Windows ainda segurando uma referência).
  ~ActivationHandler() {
    if (client_) client_->Release(); // a ativação terminou depois do prazo: ninguém mais vai usar este cliente
    if (done_) CloseHandle(done_);
  }

  HANDLE done_ = nullptr;
  std::atomic<ULONG> refs_{1};
  HRESULT activation_result_ = E_FAIL;
  HRESULT result_ = E_FAIL;
  IAudioClient* client_ = nullptr;
  bool timed_out_ = false;
};

/** Formato que pedimos ao Windows: float de 32 bits, dois canais, 48 kHz — o mesmo que o Web Audio usa. */
WAVEFORMATEXTENSIBLE MakeFormat(int sample_rate, int channels) {
  WAVEFORMATEXTENSIBLE format{};
  format.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
  format.Format.nChannels = static_cast<WORD>(channels);
  format.Format.nSamplesPerSec = static_cast<DWORD>(sample_rate);
  format.Format.wBitsPerSample = 32;
  format.Format.nBlockAlign = static_cast<WORD>(channels * 4);
  format.Format.nAvgBytesPerSec = format.Format.nSamplesPerSec * format.Format.nBlockAlign;
  format.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
  format.Samples.wValidBitsPerSample = 32;
  format.dwChannelMask = channels == 1 ? SPEAKER_FRONT_CENTER : (SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT);
  format.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  return format;
}

class Capture {
 public:
  ~Capture() { Stop(); }

  /** Liga a captura. Devolve uma mensagem de erro (vazia quando deu certo). */
  std::string Start(Napi::Env env, Napi::Function on_chunk, DWORD pid, bool include, int sample_rate, int channels) {
    Stop();

    {
      std::lock_guard<std::mutex> lock(mutex_);
      start_error_.clear();
    }
    ready_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    // Criado AQUI, antes da thread, e fechado só no Stop, depois do join: criado lá dentro, ele vazava em toda saída
    // por erro, e o Stop podia lê-lo enquanto a outra thread ainda o escrevia.
    stop_event_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    tsfn_ = Napi::ThreadSafeFunction::New(env, on_chunk, "syden-audio", 0, 1);
    running_ = true;

    worker_ = std::thread([this, pid, include, sample_rate, channels]() {
      const std::string erro = Run(pid, include, sample_rate, channels);
      if (!erro.empty()) {
        std::lock_guard<std::mutex> lock(mutex_);
        start_error_ = erro;
      }
      // Se a abertura falhou, quem chamou ainda está esperando aqui.
      if (ready_) SetEvent(ready_);
    });

    // A abertura precisa ser resolvida aqui: quem chamou quer saber na hora se o som vai vir ou não. O prazo é maior
    // que o da ativação (5 s) para o erro de lá, que diz o que houve, chegar primeiro.
    // PRAZO ESTOURADO É ERRO (auditoria do áudio, 17/10/2026): antes o resultado da espera era ignorado, e uma
    // abertura travada respondia "ok" ao JavaScript — a transmissão saía muda, com tudo dizendo que o som ia.
    const DWORD espera = WaitForSingleObject(ready_, 8000);
    std::string erro;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      erro = start_error_;
    }
    if (erro.empty() && espera != WAIT_OBJECT_0) erro = "A captura de som não respondeu a tempo";
    if (!erro.empty()) {
      Stop();
      return erro;
    }
    return {};
  }

  void Stop() {
    const bool estava = running_.exchange(false);
    if (estava && stop_event_) SetEvent(stop_event_);
    if (worker_.joinable()) worker_.join();
    if (stop_event_) {
      CloseHandle(stop_event_);
      stop_event_ = nullptr;
    }
    if (ready_) {
      CloseHandle(ready_);
      ready_ = nullptr;
    }
    if (tsfn_) {
      tsfn_.Release();
      tsfn_ = nullptr;
    }
  }

 private:
  /** Roda na thread de captura: abre o fluxo, avisa quem chamou e depois só lê som até mandarem parar. */
  std::string Run(DWORD pid, bool include, int sample_rate, int channels) {
    const auto fail = [&](const char* what, HRESULT hr) {
      char buffer[160];
      snprintf(buffer, sizeof(buffer), "%s (erro 0x%08lX)", what, static_cast<unsigned long>(hr));
      return std::string(buffer);
    };

    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    const bool com_ready = SUCCEEDED(hr);

    AUDIOCLIENT_ACTIVATION_PARAMS params{};
    params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = pid;
    // INCLUDE: só o som deste programa e dos filhos dele (a janela escolhida). Nem Discord nem Spotify entram.
    // EXCLUDE: tudo menos o Syden (a tela inteira).
    params.ProcessLoopbackParams.ProcessLoopbackMode =
        include ? PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE : PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activation{};
    activation.vt = VT_BLOB;
    activation.blob.cbSize = sizeof(params);
    activation.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

    // Toda saída daqui para baixo devolve o COM: antes, as saídas por erro o deixavam inicializado na thread.
    const auto fail_com = [&](const char* what, HRESULT code) {
      if (com_ready) CoUninitialize();
      return fail(what, code);
    };

    ActivationHandler* handler = new ActivationHandler(); // nasce com a referência desta thread
    IActivateAudioInterfaceAsyncOperation* operation = nullptr;
    hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient), &activation,
                                     handler, &operation);
    if (operation) operation->Release();
    if (FAILED(hr)) {
      handler->Release();
      return fail_com("O Windows recusou abrir a captura de som", hr);
    }

    IAudioClient* client = handler->Wait(5000);
    const HRESULT activation_error = handler->error();
    handler->Release(); // se o Windows ainda o segura (prazo estourado), ele solta depois, e o objeto vive até lá
    if (!client) return fail_com("A captura de som não abriu a tempo", activation_error);

    const WAVEFORMATEXTENSIBLE format = MakeFormat(sample_rate, channels);
    // 200 ms de folga: sobra para o Windows entregar o som mesmo se esta thread se atrasar um instante.
    hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                           AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 2000000, 0,
                           reinterpret_cast<const WAVEFORMATEX*>(&format), nullptr);
    if (FAILED(hr)) {
      client->Release();
      return fail_com("Não foi possível preparar a captura de som", hr);
    }

    HANDLE audio_event = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    client->SetEventHandle(audio_event);

    IAudioCaptureClient* capture = nullptr;
    hr = client->GetService(__uuidof(IAudioCaptureClient), reinterpret_cast<void**>(&capture));
    if (FAILED(hr)) {
      client->Release();
      CloseHandle(audio_event);
      return fail_com("A captura de som abriu, mas não entregou o fluxo", hr);
    }

    hr = client->Start();
    if (FAILED(hr)) {
      capture->Release();
      client->Release();
      CloseHandle(audio_event);
      return fail_com("A captura de som não começou", hr);
    }

    SetEvent(ready_); // daqui em diante é só ouvir

    // A CAPTURA MORRE NO MEIO (auditoria do áudio, 17/10/2026): AUDCLNT_E_DEVICE_INVALIDATED (trocou a saída de som,
    // tirou o fone), AUDCLNT_E_SERVICE_NOT_RUNNING (o serviço de áudio do Windows reiniciou). Antes o laço de dentro só
    // parava, o de fora seguia acordando à toa para sempre, e o JavaScript achava que a captura estava viva. Agora a
    // falha sai do laço e vai ao JavaScript, que decide (religar ou desistir, e o diário de saúde registra).
    HRESULT broken = S_OK;
    HANDLE waits[2] = {stop_event_, audio_event};
    while (running_ && SUCCEEDED(broken)) {
      const DWORD which = WaitForMultipleObjects(2, waits, FALSE, 1000);
      if (which == WAIT_OBJECT_0) break; // mandaram parar
      if (which == WAIT_FAILED) {
        broken = HRESULT_FROM_WIN32(GetLastError());
        break;
      }
      if (which == WAIT_TIMEOUT) continue;

      UINT32 frames = 0;
      for (;;) {
        hr = capture->GetNextPacketSize(&frames);
        if (FAILED(hr)) {
          broken = hr;
          break;
        }
        if (frames == 0) break;
        BYTE* data = nullptr;
        DWORD flags = 0;
        UINT32 got = 0;
        hr = capture->GetBuffer(&data, &got, &flags, nullptr, nullptr);
        if (FAILED(hr)) {
          broken = hr;
          break;
        }
        if (hr == AUDCLNT_S_BUFFER_EMPTY) break;

        std::vector<float> pcm(static_cast<size_t>(got) * channels, 0.0f);
        // Silêncio vem marcado e sem dados: mandamos zeros, para o som do outro lado não "pular".
        if (!(flags & AUDCLNT_BUFFERFLAGS_SILENT) && data) {
          memcpy(pcm.data(), data, pcm.size() * sizeof(float));
        }
        capture->ReleaseBuffer(got);

        if (tsfn_) {
          tsfn_.NonBlockingCall([chunk = std::move(pcm)](Napi::Env env, Napi::Function callback) {
            auto array = Napi::Float32Array::New(env, chunk.size());
            memcpy(array.Data(), chunk.data(), chunk.size() * sizeof(float));
            callback.Call({array});
          });
        }
      }
    }

    client->Stop();
    capture->Release();
    client->Release();
    CloseHandle(audio_event);
    if (com_ready) CoUninitialize();

    // O aviso vai pela mesma função dos pedaços: (null, mensagem) no lugar de (pedaço).
    if (FAILED(broken) && running_ && tsfn_) {
      const std::string message = fail("A captura de som parou no meio", broken);
      tsfn_.NonBlockingCall([message](Napi::Env env, Napi::Function callback) {
        callback.Call({env.Null(), Napi::String::New(env, message)});
      });
    }
    return {};
  }

  std::thread worker_;
  std::atomic<bool> running_{false};
  HANDLE stop_event_ = nullptr;
  HANDLE ready_ = nullptr;
  std::mutex mutex_;
  std::string start_error_;
  Napi::ThreadSafeFunction tsfn_;
  int channels_ = 2;
};

Capture g_capture;

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsFunction() || !info[1].IsObject()) {
    Napi::TypeError::New(env, "start(onChunk, { sampleRate, channels, excludePid | includePid })")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  Napi::Object options = info[1].As<Napi::Object>();
  const int sample_rate = options.Get("sampleRate").ToNumber().Int32Value();
  const int channels = options.Get("channels").ToNumber().Int32Value();
  const bool include = options.Has("includePid") && options.Get("includePid").IsNumber();
  const DWORD pid = static_cast<DWORD>(options.Get(include ? "includePid" : "excludePid").ToNumber().Int64Value());

  const std::string error = g_capture.Start(env, info[0].As<Napi::Function>(), pid, include, sample_rate, channels);
  if (!error.empty()) {
    Napi::Error::New(env, error).ThrowAsJavaScriptException();
  }
  return env.Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  g_capture.Stop();
  return info.Env().Undefined();
}

/**
 * De quem é uma janela: windowProcess(hwnd) → { pid, exe } ou null.
 *
 * O seletor do Electron identifica a janela por "window:<hwnd>:0", e o som é por PROCESSO. Esta é a ponte.
 * O exe vai junto porque há janela cujo dono não é quem toca: os apps da Store moram dentro do
 * ApplicationFrameHost, e capturar só ele daria silêncio. Quem decide o que fazer com isso é o JavaScript.
 */
Napi::Value WindowProcess(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) return env.Null();
  const HWND hwnd = reinterpret_cast<HWND>(static_cast<intptr_t>(info[0].As<Napi::Number>().Int64Value()));
  if (!IsWindow(hwnd)) return env.Null();
  DWORD pid = 0;
  GetWindowThreadProcessId(hwnd, &pid);
  if (pid == 0) return env.Null();

  std::string exe;
  if (HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid)) {
    wchar_t path[MAX_PATH];
    DWORD size = MAX_PATH;
    if (QueryFullProcessImageNameW(process, 0, path, &size)) {
      const wchar_t* name = wcsrchr(path, L'\\');
      name = name ? name + 1 : path;
      const int bytes = WideCharToMultiByte(CP_UTF8, 0, name, -1, nullptr, 0, nullptr, nullptr);
      if (bytes > 1) {
        exe.resize(static_cast<size_t>(bytes) - 1);
        WideCharToMultiByte(CP_UTF8, 0, name, -1, exe.data(), bytes, nullptr, nullptr);
      }
    }
    CloseHandle(process);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pid", Napi::Number::New(env, pid));
  result.Set("exe", Napi::String::New(env, exe));
  return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("windowProcess", Napi::Function::New(env, WindowProcess));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("faixaDeIdade", Napi::Function::New(env, FaixaDeIdade));
  return exports;
}

}  // namespace

NODE_API_MODULE(syden_audio, Init)
