// A FAIXA DE IDADE QUE O WINDOWS INFORMA (20/10/2026; ver "Adolescentes no Syden" no CLAUDE.md e
// https://learn.microsoft.com/windows/apps/develop/security/age-signals/).
//
// O Windows devolve só a faixa (abaixo de 10, 10-12, 13-15, 16-17, 18+) e se ela foi VERIFICADA, nunca a data. Precisa
// de: a capacidade userAccountInformation no pacote (desktop/package.json), o "sim" da pessoa em Privacidade →
// Informações da conta, e uma conta Microsoft no Windows. Faltando qualquer um, ou com a função ainda desligada pela
// Microsoft (em 20/10/2026 ela só existe para os Insiders), a resposta é "sem faixa" — e o Syden segue com a data que a
// pessoa informou.
//
// A chamada espera a resposta do Windows (.get()), então roda numa thread à parte e devolve uma Promise: o processo
// principal do app não trava esperando.
#include <napi.h>
#include <climits>
#include <string>

#include "idade-disponivel.h"

#if SYDEN_IDADE
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Metadata.h>
#include <winrt/Windows.System.h>
#endif

namespace {

class LerIdade : public Napi::AsyncWorker {
 public:
  explicit LerIdade(Napi::Env env) : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)) {}
  Napi::Promise Promise() { return deferred_.Promise(); }

  void Execute() override {
#if SYDEN_IDADE
    try {
      try {
        winrt::init_apartment(winrt::apartment_type::multi_threaded);
      } catch (...) {
        // a thread já estava num apartamento: serve do jeito que está
      }
      using winrt::Windows::Foundation::Metadata::ApiInformation;
      if (!ApiInformation::IsMethodPresent(L"Windows.System.User", L"GetUserAgeRangeAsync")) {
        motivo_ = "sem-api";
        return;
      }
      auto usuario = winrt::Windows::System::User::GetDefault();
      if (!usuario) {
        motivo_ = "sem-usuario";
        return;
      }
      auto faixa = usuario.GetUserAgeRangeAsync().get();
      if (faixa) {
        temFaixa_ = true;
        menor_ = faixa.Lower();
        maior_ = faixa.Upper();
      }
      if (ApiInformation::IsMethodPresent(L"Windows.System.User", L"GetAgeVerificationStatusAsync")) {
        using winrt::Windows::System::UserAgeVerificationStatus;
        switch (usuario.GetAgeVerificationStatusAsync().get()) {
          case UserAgeVerificationStatus::Verified: verificacao_ = "verificada"; break;
          case UserAgeVerificationStatus::Unverified: verificacao_ = "nao-verificada"; break;
          case UserAgeVerificationStatus::OptedOut: verificacao_ = "recusada"; break;
          case UserAgeVerificationStatus::TemporarilyUnavailable: verificacao_ = "indisponivel"; break;
          default: verificacao_ = "nao-se-aplica"; break;
        }
      }
      motivo_ = "ok";
    } catch (winrt::hresult_error const& e) {
      // E_ACCESSDENIED: a pessoa não deu o "sim" em Informações da conta (ou o pacote não declara a capacidade)
      motivo_ = e.code() == winrt::hresult(static_cast<int32_t>(0x80070005)) ? "sem-permissao" : "erro";
      hr_ = static_cast<int32_t>(e.code());
    } catch (...) {
      motivo_ = "erro";
    }
#else
    motivo_ = "sem-api";
#endif
  }

  void OnOK() override {
    Napi::Env env = Env();
    Napi::Object r = Napi::Object::New(env);
    r.Set("motivo", motivo_);
    r.Set("verificacao", verificacao_);
    if (temFaixa_) {
      Napi::Object faixa = Napi::Object::New(env);
      faixa.Set("menor", menor_);
      // 18+ vem com o teto no máximo do int32: vai como null, "sem teto"
      faixa.Set("maior", maior_ >= INT_MAX ? env.Null() : Napi::Number::New(env, maior_));
      r.Set("faixa", faixa);
    } else {
      r.Set("faixa", env.Null());
    }
    if (hr_) r.Set("hr", hr_);
    deferred_.Resolve(r);
  }

  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  std::string motivo_ = "erro";
  std::string verificacao_ = "nao-se-aplica";
  bool temFaixa_ = false;
  int32_t menor_ = 0;
  int32_t maior_ = 0;
  int32_t hr_ = 0;
};

}  // namespace

Napi::Value FaixaDeIdade(const Napi::CallbackInfo& info) {
  auto* trabalho = new LerIdade(info.Env());
  auto promessa = trabalho->Promise();
  trabalho->Queue();
  return promessa;
}
