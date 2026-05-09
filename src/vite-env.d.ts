/// <reference types="vite/client" />

// Variables de entorno locales — no se usan conexiones externas
interface ImportMetaEnv {
    readonly VITE_API_PORT?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
