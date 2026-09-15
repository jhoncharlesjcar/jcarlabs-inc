# JCAR Labs Inc. — Corporate Web Platform

[![Built by JCAR Labs Inc.](https://img.shields.io/badge/Engineered%20by-JCAR%20Labs%20Inc.-00ff88?style=for-the-badge&logo=codeforces&logoColor=black)](https://github.com/jhoncharlesjcar/Website_JcarLabs_Inc)
[![Framework - Astro 7](https://img.shields.io/badge/Framework-Astro%207-BC52EE?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Deployment - Vercel](https://img.shields.io/badge/Deploy-Vercel%20Ready-black?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

Plataforma web corporativa oficial de **JCAR Labs Inc.**, concebida, diseñada y desarrollada íntegramente por su equipo de ingeniería como un escaparate de vanguardia tecnológica, diseño interactivo de alta fidelidad y rendimiento de nivel empresarial.

---

## 🏛️ Sobre JCAR Labs Inc.

**JCAR Labs Inc.** es un estudio de ingeniería de software para negocios. Conectamos soluciones digitales con decisiones sólidas de arquitectura, datos, infraestructura cloud y seguridad, permitiendo a las organizaciones construir, modernizar y escalar productos de alto impacto.

### Portafolio de Soluciones Integradas

| # | Solución | Enfoque Tecnológico | Ruta en la Plataforma |
|---|---|---|---|
| **01** | **Desarrollo de Software a Medida & Productos SaaS** | React, Node.js, SQL, Arquitecturas Multitenant | `/services/desarrollo-web` |
| **02** | **Integración de IA Transmodal, Agentes & LLMOps** | Python, LangChain, Modelos Multimodales, Supervisión | `/services/inteligencia-artificial` |
| **03** | **Arquitectura Cloud, APIs & Microservicios** | Node.js, Java, Python, REST/gRPC, Observabilidad | `/services/desarrollo-full-stack` |
| **04** | **Modernización e Ingeniería de Sistemas Legacy** | Java, PHP, SQL, Migración por Etapas sin Downtime | `/services/software-empresarial` |
| **05** | **Consultoría de Arquitectura & Auditoría de Código** | Análisis Estático, Seguridad, Rendimiento, Escalabilidad | `/services/auditoria-de-codigo` |

---

## ⚡ Arquitectura y Tecnologías

La plataforma ha sido construida combinando rendimiento estático extremo con interactividad cinemática avanzada:

* **Core Framework:** [Astro 7](https://astro.build/) con generación estática (SSG) y tipado estricto con [TypeScript](https://www.typescriptlang.org/).
* **Experiencia Visual:** HTML exportado de Framer, con copy corporativo aplicado en build (`corporate-document.mjs`) y en el cliente (`brand-content.js`).
* **Servidor y Edge Runtime:**
  * Transporte HTTP de producción (`src/server/http.mjs`) con compresión nativa (Gzip/Brotli/Deflate), streaming de rangos HTTP (Byte Ranges para video y CMS binario).
  * Cabeceras de seguridad estrictas (Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options).
  * Funciones Serverless dedicadas para Vercel (`api/framercms.js`) garantizando paridad total en despliegues distribuidos.
* **SEO & Optimización Semántica:** Metadatos dinámicos OpenGraph/Twitter Cards, marcado estructurado JSON-LD, sitemap XML automatizado y robots.txt configurables por entorno.

---

## 📁 Estructura del Proyecto

```text
├── api/                   # Funciones Serverless (e.g. Vercel runtime handlers)
├── public/                # Assets estáticos servidos en CDN (imágenes, videos, fuentes, CSS)
├── scripts/               # Scripts de build, generación de contenido y servidor de producción
│   ├── lib/               # Utilidades de generación de metadatos y scripts
│   ├── generate-corporate-content.mjs
│   └── serve.mjs
├── src/
│   ├── content/           # Contenido corporativo maestro (corporate.mjs, routes.json, copy)
│   ├── layouts/           # Plantillas base y layouts limpios
│   ├── lib/               # Utilidades de renderizado, metadatos y extracción de documentos
│   ├── pages/             # Rutas Astro de la plataforma (Inicio, Servicios, Casos, Contacto, 404)
│   └── server/            # Motor de transporte HTTP, compresión y seguridad
├── astro.config.mjs       # Configuración central de Astro
├── package.json           # Dependencias y scripts de ejecución
├── tsconfig.json          # Configuración de compilación TypeScript
└── vercel.json            # Configuración de despliegue en Vercel (Edge, Routing, Headers)
```

---

## 🛠️ Guía de Ejecución Local

### Requisitos Previos
* **Node.js:** Versión 22.12.0 o superior (recomendado Node 22 LTS o 24).
* Gestor de paquetes: **pnpm** (recomendado), **npm** o **yarn**.

### Instalación de Dependencias
```sh
# Usando pnpm
pnpm install

# O usando npm
npm install
```

### Entorno de Desarrollo
Inicia el servidor local con recarga rápida:
```sh
pnpm run dev
```
La aplicación estará disponible de inmediato en [http://127.0.0.1:4321](http://127.0.0.1:4321).

### Compilación y Producción
```sh
# Verificación de tipos TypeScript y Astro
pnpm run check

# Compilación completa para producción
pnpm run build

# Iniciar servidor de producción local con compresión y caché activa
pnpm start
```

---

## 🚀 Despliegue en Producción (Vercel)

El proyecto incluye configuración para desplegar en **Vercel**:

1. **Conexión con GitHub:** Conecta el repositorio `jhoncharlesjcar/Website_JcarLabs_Inc` desde el panel de Vercel.
2. **Configuración Automática:** Vercel reconocerá la configuración provista en `vercel.json`:
   * **Build Command:** `pnpm run build:vercel`
   * **Output Directory:** `dist`
   * **Serverless Functions:** Manejadores en `api/` incluidos automáticamente.
   * **Caching Headers:** Políticas `immutable` de 1 año para assets estáticos y revalidación para HTML.

El CMS de Framer requiere la función `/api/framercms?file=...&range=...`. El build instala el adaptador de carga en todas las páginas, y desarrollo/preview ofrecen la misma URL. No debe sustituirse por una reescritura desde los archivos de `/assets/cms`: Vercel prioriza esos archivos estáticos y devolvería el binario completo, ignorando los rangos. Subir solo `dist` a un alojamiento estático no incluye esta función.

Diagnóstico, pruebas y comprobaciones posteriores al despliegue: [Auditoría de despliegue](docs/AUDITORIA-DESPLIEGUE-2026-09-14.md).

---

## 💼 Créditos y Propiedad

© 2026 **JCAR Labs Inc.** Todos los derechos reservados.  
Diseño, desarrollo, ingeniería de software y arquitectura construidos íntegramente por **JCAR Labs Inc.**
