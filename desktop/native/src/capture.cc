// Captura o som do computador MENOS o do próprio Syden.
//
// O Windows não deixa um programa gravar o som de outro, mas desde a versão 2004 ele oferece o contrário:
// "me dê tudo o que está tocando, exceto esta árvore de processos". Apontando essa exceção para o próprio
// Syden, sobra o que a pessoa quer transmitir — o jogo, o vídeo, o navegador — sem as vozes de quem está
// na chamada, que é o eco que incomodava todo mundo.
//
// O caminho é o WASAPI: ativa-se um cliente de áudio "virtual" (VAD\Process_Loopback) passando o processo
// a excluir, e a partir daí a leitura é igual à de um microfone qualquer. Os pedaços de som saem daqui
// para o JavaScript por uma função segura entre threads.

#include <napi.h>

#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>

#include <atomic>
#include <thread>
#include <vector>

namespace {

// Espera a ativação do cliente de áudio, que o Windows faz em outra thread.
class ActivationHandler : public IActivateAudioInterfaceCompletionHandler {
 public:
  ActivationHandler() : done_(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {}
  ~ActivationHandler() {
    if (done_) CloseHandle(done_);
  }

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
      *object = this;
      AddRef();
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }
  ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG left = --refs_;
    return left; // o dono do objeto é a pilha; não se destrói sozinho
  }

  /** Espera o Windows terminar a ativação; devolve o cliente de áudio ou nulo. */
  IAudioClient* Wait(DWORD timeout_ms) {
    if (WaitForSingleObject(done_, timeout_ms) != WAIT_OBJECT_0) return nullptr;
    return SUCCEEDED(activation_result_) && SUCCEEDED(result_) ? client_ : nullptr;
  }

  HRESULT error() const { return FAILED(activation_result_) ? activation_result_ : result_; }

 private:
  HANDLE done_ = nullptr;
  std::atomic<ULONG> refs_{1};
  HRESULT activation_result_ = E_FAIL;
  HRESULT result_ = E_FAIL;
  IAudioClient* client_ = nullptr;
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
  std::string Start(Napi::Env env, Napi::Function on_chunk, DWORD exclude_pid, int sample_rate, int channels) {
    Stop();
    channels_ = channels;

    tsfn_ = Napi::ThreadSafeFunction::New(env, on_chunk, "syden-audio", 0, 1);
    running_ = true;

    std::string error;
    HANDLE ready = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    worker_ = std::thread([this, exclude_pid, sample_rate, channels, ready, &error]() {
      error = Run(exclude_pid, sample_rate, channels, ready);
    });
    // A abertura precisa ser resolvida aqui: quem chamou quer saber na hora se o som vai vir ou não.
    WaitForSingleObject(ready, 5000);
    CloseHandle(ready);

    if (!error.empty()) {
      Stop();
      return error;
    }
    return {};
  }

  void Stop() {
    if (!running_.exchange(false)) {
      if (worker_.joinable()) worker_.join();
      return;
    }
    if (stop_event_) SetEvent(stop_event_);
    if (worker_.joinable()) worker_.join();
    if (tsfn_) {
      tsfn_.Release();
      tsfn_ = nullptr;
    }
  }

 private:
  /** Roda na thread de captura: abre o fluxo, avisa quem chamou e depois só lê som até mandarem parar. */
  std::string Run(DWORD exclude_pid, int sample_rate, int channels, HANDLE ready) {
    const auto fail = [&](const char* what, HRESULT hr) {
      SetEvent(ready);
      char buffer[160];
      snprintf(buffer, sizeof(buffer), "%s (erro 0x%08lX)", what, static_cast<unsigned long>(hr));
      return std::string(buffer);
    };

    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    const bool com_ready = SUCCEEDED(hr);

    AUDIOCLIENT_ACTIVATION_PARAMS params{};
    params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = exclude_pid;
    params.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activation{};
    activation.vt = VT_BLOB;
    activation.blob.cbSize = sizeof(params);
    activation.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

    ActivationHandler handler;
    IActivateAudioInterfaceAsyncOperation* operation = nullptr;
    hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient), &activation,
                                     &handler, &operation);
    if (operation) operation->Release();
    if (FAILED(hr)) return fail("O Windows recusou abrir a captura de som", hr);

    IAudioClient* client = handler.Wait(5000);
    if (!client) return fail("A captura de som não abriu a tempo", handler.error());

    const WAVEFORMATEXTENSIBLE format = MakeFormat(sample_rate, channels);
    // 200 ms de folga: sobra para o Windows entregar o som mesmo se esta thread se atrasar um instante.
    hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                           AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 2000000, 0,
                           reinterpret_cast<const WAVEFORMATEX*>(&format), nullptr);
    if (FAILED(hr)) {
      client->Release();
      return fail("Não foi possível preparar a captura de som", hr);
    }

    stop_event_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    HANDLE audio_event = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    client->SetEventHandle(audio_event);

    IAudioCaptureClient* capture = nullptr;
    hr = client->GetService(__uuidof(IAudioCaptureClient), reinterpret_cast<void**>(&capture));
    if (FAILED(hr)) {
      client->Release();
      CloseHandle(audio_event);
      return fail("A captura de som abriu, mas não entregou o fluxo", hr);
    }

    hr = client->Start();
    if (FAILED(hr)) {
      capture->Release();
      client->Release();
      CloseHandle(audio_event);
      return fail("A captura de som não começou", hr);
    }

    SetEvent(ready); // daqui em diante é só ouvir

    HANDLE waits[2] = {stop_event_, audio_event};
    while (running_) {
      const DWORD which = WaitForMultipleObjects(2, waits, FALSE, 1000);
      if (which == WAIT_OBJECT_0) break; // mandaram parar
      if (which == WAIT_TIMEOUT) continue;

      UINT32 frames = 0;
      while (SUCCEEDED(capture->GetNextPacketSize(&frames)) && frames > 0) {
        BYTE* data = nullptr;
        DWORD flags = 0;
        UINT32 got = 0;
        if (FAILED(capture->GetBuffer(&data, &got, &flags, nullptr, nullptr))) break;

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
    CloseHandle(stop_event_);
    stop_event_ = nullptr;
    if (com_ready) CoUninitialize();
    return {};
  }

  std::thread worker_;
  std::atomic<bool> running_{false};
  HANDLE stop_event_ = nullptr;
  Napi::ThreadSafeFunction tsfn_;
  int channels_ = 2;
};

Capture g_capture;

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsFunction() || !info[1].IsObject()) {
    Napi::TypeError::New(env, "start(onChunk, { sampleRate, channels, excludePid })").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  Napi::Object options = info[1].As<Napi::Object>();
  const int sample_rate = options.Get("sampleRate").ToNumber().Int32Value();
  const int channels = options.Get("channels").ToNumber().Int32Value();
  const DWORD exclude_pid = static_cast<DWORD>(options.Get("excludePid").ToNumber().Int64Value());

  const std::string error = g_capture.Start(env, info[0].As<Napi::Function>(), exclude_pid, sample_rate, channels);
  if (!error.empty()) {
    Napi::Error::New(env, error).ThrowAsJavaScriptException();
  }
  return env.Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  g_capture.Stop();
  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  return exports;
}

}  // namespace

NODE_API_MODULE(syden_audio, Init)
