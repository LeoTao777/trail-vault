/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 开发期 /api 反代目标，默认 http://127.0.0.1:8080 */
  readonly VITE_API_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
