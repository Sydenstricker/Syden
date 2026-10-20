{
  "targets": [
    {
      "target_name": "syden_audio",
      "sources": ["src/capture.cpp", "src/idade.cpp"],
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")", "gerado"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE"],
      "conditions": [
        [
          "OS==\"win\"",
          {
            "libraries": ["-lmmdevapi.lib", "-lole32.lib", "-lavrt.lib", "-luser32.lib", "-lwindowsapp.lib"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": ["/std:c++17", "/bigobj"]
              }
            }
          }
        ]
      ]
    }
  ]
}
