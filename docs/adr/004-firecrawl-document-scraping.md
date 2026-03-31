# ADR 004: Firecrawl Document Scraping Pattern

**Status:** Documentado para referencia - Posible adaptación para scraping de contratos existentes
**Fecha:** 2026-03-31
**Contexto:** Documentación de cómo se extraen documentos web como contexto adicional para el LLM

---

## Resumen

Firecrawl es un servicio de web scraping que convierte páginas HTML en markdown limpio. En Open Canvas, se usa para que los usuarios puedan proporcionar URLs de documentación, artículos, o referencias que el LLM debe considerar al generar/editar artifacts.

## Casos de Uso para Contract Drafter

1. **Importar contratos existentes:** Scrape un contrato publicado en web para usarlo como template
2. **Extraer términos y condiciones:** Importar T&C de un proveedor desde su sitio web
3. **Referencias legales:** Extraer texto de artículos de ley o regulaciones desde sitios oficiales
4. **Benchmarking:** Importar contratos públicos de otras empresas como referencia
5. **Plantillas externas:** Scrape templates de contratos desde repositorios legales

---

## Arquitectura

### 1. Flujo de Datos

```
Usuario proporciona URL(s) en el chat o via attachment
        ↓
Frontend detecta URLs en el mensaje
        ↓
POST /api/firecrawl/scrape con { urls: string[] }
        ↓
API llama a Firecrawl service para cada URL
        ↓
Firecrawl extrae contenido y convierte a markdown
        ↓
API retorna array de ContextDocument[]
        ↓
GraphContext inyecta documentos en GraphInput
        ↓
LLM recibe contexto adicional al procesar mensaje
```

### 2. Estructura de Archivos

```
src/
├── app/api/firecrawl/
│   └── scrape/
│       └── route.ts               # API endpoint
├── hooks/
│   └── useContextDocuments.tsx    # Manejo de context documents
└── contexts/
    └── GraphContext.tsx           # Inyección en GraphInput
```

---

## Implementación Detallada

### A. API de Scraping

**Archivo:** `src/app/api/firecrawl/scrape/route.ts`

```typescript
import { FireCrawlLoader } from "@langchain/community/document_loaders/web/firecrawl";
import { ContextDocument } from "@opencanvas/shared/types";

export async function POST(req: NextRequest) {
  const { urls } = await req.json() as { urls: string[] };

  if (!urls) {
    return NextResponse.json({ error: "`urls` is required." }, { status: 400 });
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    return NextResponse.json({ error: "Firecrawl API key is missing" }, { status: 400 });
  }

  const contextDocuments: ContextDocument[] = [];

  for (const url of urls) {
    // 1. Configurar loader de Firecrawl
    const loader = new FireCrawlLoader({
      url,
      mode: "scrape",           // Modo scrape (no crawl toda la web)
      params: {
        formats: ["markdown"],  // Convertir a markdown
      },
    });

    // 2. Limpiar URL para usar como nombre
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const path = urlObj.pathname;
    const cleanedUrl = `${hostname}${path}`;

    // 3. Ejecutar scraping
    const docs = await loader.load();
    const text = docs.map((doc) => doc.pageContent).join("\n");

    // 4. Agregar a lista de documentos
    contextDocuments.push({
      name: cleanedUrl,
      type: "text",
      data: text,
      metadata: { url },
    });
  }

  return NextResponse.json({
    success: true,
    documents: contextDocuments
  }, { status: 200 });
}
```

#### Características de Firecrawl

**Ventajas sobre scraping manual:**
- **Anti-bot evasion:** Maneja CAPTCHAs, rate limiting, etc.
- **JavaScript rendering:** Ejecuta JS para sitios SPA (React, Vue, etc.)
- **Limpieza automática:** Elimina nav, footer, ads, scripts
- **Markdown conversion:** HTML → Markdown preservando estructura
- **Metadata extraction:** Extrae título, autor, fecha, etc.

**Limitaciones:**
- Costo: ~$0.001 por página (más caro que scraping manual)
- Rate limits: 60 requests/min (tier gratuito)
- No funciona con paywalls o auth requerido
- Sitios con anti-scraping agresivo pueden fallar

---

### B. Tipos de Datos

```typescript
export interface ContextDocument {
  name: string;              // Nombre identificador (ej: "example.com/page")
  type: "text" | "image";   // Tipo de documento
  data: string;              // Contenido (texto o base64 de imagen)
  metadata?: {
    url?: string;            // URL original
    source?: "firecrawl" | "audio_transcription" | "upload";
  };
}
```

---

### C. Integración con GraphContext

**Archivo:** `src/contexts/GraphContext.tsx`

```typescript
// En streamMessage:
const contextDocuments = [
  ...transcribedAudioDocuments,    // De whisper/audio
  ...firecrawlScrapedDocuments,    // De firecrawl
  ...uploadedDocuments,            // De file uploads
];

const input: GraphInput = {
  messages,
  artifact,
  contextDocuments,  // Inyectado aquí
};
```

**El LLM recibe:**

```
System: You have access to the following context documents:

1. **example.com/contract-template**
   [Markdown del contrato scrapeado]

2. **audio_transcription_meeting.mp3**
   [Texto transcrito de la reunión]

User: "Crea un contrato basándote en el template y los acuerdos de la reunión"
```

---

## Cómo el Usuario Proporciona URLs

### Opción 1: Mención en el chat

```
Usuario: "Usa este template: https://example.com/contract-template.pdf
         para crear un nuevo contrato"

Frontend detecta URL → Llama /api/firecrawl/scrape
```

### Opción 2: Attachment de tipo URL

```typescript
// Composer permite attachments de tipo "url"
<ComposerAddAttachment
  acceptedTypes={["url", "image", "document", "audio"]}
/>
```

### Opción 3: Comando explícito

```
Usuario: "/add-context https://example.com/legal-terms"

Frontend interpreta comando → Scrape URL → Agregar a contexto
```

---

## Casos de Uso Específicos para Contract Drafter

### 1. Importar Template de Contrato

```typescript
// Usuario: "Usa este template: https://contracts-repo.com/purchase-order-template"

// Backend:
const scrapedContract = await scrapeURL("https://contracts-repo.com/purchase-order-template");

// LLM prompt:
"Basándote en el siguiente template, crea un nuevo contrato de compra adaptado para [supplier_name]:

[Template markdown]

Mantén la estructura pero adapta las cláusulas según las necesidades del cliente."
```

### 2. Extraer Términos y Condiciones

```typescript
// Usuario: "Extrae los términos de entrega desde https://supplier.com/terms"

const terms = await scrapeURL("https://supplier.com/terms");

// LLM identifica sección relevante:
"He extraído los siguientes términos de entrega:

- Plazo de entrega: 30-45 días
- Envío: FOB origen
- Inspección: 5 días post-entrega
- ...

¿Quieres que agregue alguna de estas cláusulas al contrato?"
```

### 3. Benchmarking de Contratos Públicos

```typescript
// Usuario: "Compara nuestro contrato con estos contratos públicos: [URLs]"

const publicContracts = await Promise.all(urls.map(scrapeURL));

// LLM analiza:
"Análisis comparativo:

Nuestro contrato vs. promedio industria:
- Plazo de pago: 60 días vs. 45 días (más generoso)
- Penalidad por retraso: 1% vs. 2% (menos estricto)
- Garantía: 12 meses vs. 24 meses (menos cobertura)

Recomendaciones: ..."
```

---

## Limitaciones y Consideraciones

### A. Formato de Documentos

Firecrawl funciona mejor con:
- ✅ HTML estático
- ✅ Sitios SPA (React, Vue, Angular)
- ✅ Markdown/Text plano
- ⚠️ PDFs embebidos (si están en `<iframe>`)
- ❌ PDFs descargables (requiere otro approach)
- ❌ DOCX/Google Docs (requiere API específica)

**Para Contract Drafter:**
```typescript
// Detectar tipo de archivo por extensión
const fileType = new URL(url).pathname.split('.').pop();

if (fileType === 'pdf') {
  // Usar PDF parser (pdf-parse, pdf.js)
  return await parsePDF(url);
} else if (fileType === 'docx') {
  // Usar mammoth.js para DOCX
  return await parseDocx(url);
} else {
  // Usar Firecrawl para HTML
  return await scrapeURL(url);
}
```

### B. Rate Limiting

Firecrawl limita requests/min. Para múltiples URLs:

```typescript
// Procesar en batch con rate limiting
const scrapedDocs = await pMap(
  urls,
  async (url) => await scrapeURL(url),
  { concurrency: 5 }  // Max 5 requests simultáneos
);
```

### C. Costo

- **Firecrawl:** ~$0.001 por página
- **Estimación:** 100 contratos/mes = $0.10/mes
- **Tier gratuito:** 500 requests/mes

---

## Alternativas a Firecrawl

| Servicio | Pros | Contras | Costo |
|----------|------|---------|-------|
| **Firecrawl** | Fácil integración, markdown output | Caro para alto volumen | $0.001/page |
| **Puppeteer** | Control total, gratuito | Requiere infraestructura, complejo | Gratis (self-hosted) |
| **Apify** | Scraping robusto, anti-bot | API compleja | $0.002/page |
| **Cheerio** | Muy rápido, simple | Solo HTML estático (no JS) | Gratis |
| **Playwright** | Moderno, cross-browser | Setup complejo | Gratis (self-hosted) |

**Decisión para MVP:** Firecrawl por facilidad. Considerar migrar a Playwright si volumen crece.

---

## Implementación de PDF Parser (Complemento)

Para documentos PDF (comunes en contratos):

```typescript
// src/app/api/firecrawl/scrape/route.ts (extendido)
import pdf from "pdf-parse";

async function parsePDF(url: string): Promise<string> {
  // 1. Descargar PDF
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. Parsear con pdf-parse
  const data = await pdf(buffer);

  // 3. Limpiar texto (remover headers/footers repetitivos)
  const cleanedText = data.text
    .split('\n')
    .filter(line => line.trim().length > 0)
    .join('\n');

  return cleanedText;
}

// En el endpoint:
const fileType = new URL(url).pathname.split('.').pop();

if (fileType === 'pdf') {
  const text = await parsePDF(url);
  contextDocuments.push({
    name: cleanedUrl,
    type: "text",
    data: text,
    metadata: { url, source: "pdf_parser" },
  });
} else {
  // Usar Firecrawl para HTML
  // ...código existente
}
```

---

## Seguridad y Validación

### A. Validar URLs

```typescript
function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Solo permitir HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    // Bloquear localhost/internal IPs (SSRF protection)
    if (parsed.hostname === 'localhost' ||
        parsed.hostname.startsWith('127.') ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

### B. Content Length Limits

```typescript
const MAX_CONTENT_LENGTH = 100_000; // 100KB

if (text.length > MAX_CONTENT_LENGTH) {
  // Truncar o rechazar
  text = text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[...truncado]";
}
```

### C. SSRF Protection

No permitir scraping de:
- `localhost`, `127.0.0.1`
- IPs privadas (`192.168.x.x`, `10.x.x.x`)
- Internal services
- Cloud metadata endpoints (`169.254.169.254`)

---

## Variables de Entorno

```bash
# Firecrawl API
FIRECRAWL_API_KEY=fc-xxx

# Opcional: configuración
FIRECRAWL_TIMEOUT=30000          # 30 segundos timeout
FIRECRAWL_MAX_PAGES_PER_REQUEST=10
```

---

## Manejo de Errores

```typescript
try {
  const docs = await loader.load();
  // ...
} catch (error: any) {
  console.error(`Failed to scrape ${url}:`, error);

  // Continuar con otras URLs si una falla
  contextDocuments.push({
    name: cleanedUrl,
    type: "text",
    data: `[Error scraping ${url}: ${error.message}]`,
    metadata: { url, source: "firecrawl_error" },
  });
}
```

**Errores comunes:**
1. **Timeout:** Sitio lento o no responde
2. **403 Forbidden:** Anti-bot detectó scraping
3. **404 Not Found:** URL inválida
4. **CAPTCHA:** Sitio requiere verificación humana

---

## Testing

```typescript
// tests/api/firecrawl.test.ts
describe("Firecrawl API", () => {
  it("should scrape a simple HTML page", async () => {
    const response = await POST(new Request("http://localhost:3000/api/firecrawl/scrape", {
      method: "POST",
      body: JSON.stringify({ urls: ["https://example.com"] }),
    }));

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].type).toBe("text");
  });

  it("should handle invalid URLs", async () => {
    const response = await POST(new Request("http://localhost:3000/api/firecrawl/scrape", {
      method: "POST",
      body: JSON.stringify({ urls: ["not-a-url"] }),
    }));

    expect(response.status).toBe(400);
  });
});
```

---

## Conclusión

El patrón de Firecrawl es útil para Contract Drafter en casos específicos:

✅ **Usar Firecrawl para:**
- Templates de contratos públicos en HTML
- T&C de proveedores en sus sitios web
- Referencias legales en sitios oficiales

❌ **No usar Firecrawl para:**
- PDFs descargables (usar pdf-parse)
- DOCX/Google Docs (usar mammoth.js o Google Docs API)
- Contratos internos (usar upload directo)

**Recomendación:** Implementar en Sprint 2-3 como feature opcional, complementando con parsers de PDF/DOCX para máxima cobertura.

---

## Referencias

- **API Route:** `src/app/api/firecrawl/scrape/route.ts`
- **Firecrawl SDK:** `@langchain/community/document_loaders/web/firecrawl`
- **Documentación:** https://docs.firecrawl.dev
- **Tipos:** `packages/shared/src/types.ts` → `ContextDocument`
- **PDF Parser:** `pdf-parse` package
- **DOCX Parser:** `mammoth` package
