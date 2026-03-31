# ADR 002: Audio Transcription Implementation (Whisper/Groq)

**Status:** Deshabilitado temporalmente - Se reactivará para Contract Drafter
**Fecha:** 2026-03-31
**Contexto:** Documentación de la implementación de transcripción de audio vía Groq Whisper

---

## Resumen

El sistema permite a los usuarios adjuntar archivos de audio/video que son automáticamente transcritos usando el modelo Whisper de Groq. Los archivos se suben temporalmente a Supabase Storage, se transcriben, y luego se eliminan. La transcripción se inyecta como contexto en el mensaje del usuario.

## Casos de Uso para Contract Drafter

1. **Transcripción de reuniones:** Grabar acuerdos verbales con proveedores y convertirlos en cláusulas
2. **Notas de voz:** Dictar instrucciones o modificaciones al contrato
3. **Entrevistas con stakeholders:** Capturar requisitos de negociación
4. **Minutas de reunión:** Extraer compromisos y transformarlos en términos contractuales

---

## Arquitectura

### 1. Flujo de Datos

```
Usuario adjunta archivo audio/video
        ↓
ComposerAddAttachment (assistant-ui)
        ↓
AttachmentAdapter detecta tipo de archivo
        ↓
Si es audio/video → subir a Supabase Storage
        ↓
POST /api/whisper/audio con { path: supabaseFilePath }
        ↓
API descarga de Supabase → envía a Groq Whisper
        ↓
Transcripción retorna como texto
        ↓
Archivo se elimina de Supabase
        ↓
Texto se inyecta en el mensaje como ContextDocument
```

### 2. Estructura de Archivos

```
src/
├── app/api/whisper/
│   └── audio/
│       └── route.ts                    # API endpoint de transcripción
├── components/assistant-ui/
│   └── attachment.tsx                  # UI de attachments
├── hooks/
│   └── useContextDocuments.tsx         # Manejo de attachments adapter
└── contexts/
    └── GraphContext.tsx                # Inyección de contexto
```

---

## Implementación Detallada

### A. API de Transcripción

**Archivo:** `src/app/api/whisper/audio/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const { path } = await req.json();  // Path en Supabase Storage

  // 1. Validar credenciales
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL_DOCUMENTS ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DOCUMENTS) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 400 });
  }

  // 2. Descargar archivo de Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL_DOCUMENTS,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DOCUMENTS
  );

  const supabaseFile = await supabase.storage
    .from("documents")
    .download(path);

  if (supabaseFile.error) {
    return NextResponse.json({ error: "Failed to download file" }, { status: 400 });
  }

  // 3. Convertir Blob a File con tipo MIME correcto
  const mimeType = supabaseFile.data.type;
  const fileExtension = mimeType.split("/")[1];
  const file = new File([supabaseFile.data], `audio.${fileExtension}`, {
    type: mimeType,
  });

  // 4. Transcribir con Groq Whisper
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "distil-whisper-large-v3-en",  // Modelo optimizado
    language: "en",                       // Configurable por región
    temperature: 0.0,                      // Determinista
  });

  // 5. Limpiar archivo temporal
  await supabase.storage.from("documents").remove([path]);

  return NextResponse.json({
    success: true,
    text: transcription.text
  }, { status: 200 });
}
```

#### Decisiones de Diseño

**¿Por qué Supabase Storage como intermediario?**
- NextJS tiene límite de tamaño de payload (default 4MB)
- Archivos de audio/video pueden ser grandes (50MB+)
- Supabase Storage acepta uploads grandes desde el cliente
- API solo maneja el path, no el archivo completo

**¿Por qué Groq en lugar de OpenAI Whisper?**
- Groq es **10-100x más rápido** (inferencia en hardware especializado)
- Costo comparable o menor
- Modelo `distil-whisper-large-v3-en` es optimizado para inglés

**¿Por qué eliminar el archivo después?**
- Privacidad: archivos de audio pueden contener info sensible
- Costo: storage cuesta dinero
- Temporalidad: solo necesitamos la transcripción

---

### B. Componente de Attachments

**Archivo:** `src/components/assistant-ui/attachment.tsx`

El componente usa `@assistant-ui/react` que proporciona primitivas para attachments:

```typescript
// Primitivas disponibles:
- AttachmentPrimitive.Root
- AttachmentPrimitive.Name
- useAttachment() // Hook para acceder al estado del attachment
```

#### Tipos de Attachments

```typescript
type AttachmentType = "image" | "document" | "file";

// Detectado automáticamente por MIME type:
const typeLabel = useAttachment((a) => {
  switch (a.type) {
    case "image":   return "Image";
    case "document": return "Document";  // PDF, DOCX, etc.
    case "file":    return "File";        // Audio, video, etc.
  }
});
```

#### UI de Preview

```typescript
const AttachmentThumb: FC = () => {
  const isImage = useAttachment((a) => a.type === "image");
  const src = useAttachmentSrc();

  return (
    <Avatar className="bg-muted flex size-10 items-center justify-center">
      <AvatarFallback delayMs={isImage ? 200 : 0}>
        <FileIcon />
      </AvatarFallback>
      <AvatarImage src={src} />  {/* Solo para imágenes */}
    </Avatar>
  );
};
```

**Features:**
- Preview de imágenes en dialog expandible
- Fallback genérico con `FileIcon` para audio/documentos
- Botón remove (solo si `source !== "message"`)
- Tooltip con nombre y tipo de archivo

---

### C. Attachment Adapter

**Archivo:** `src/hooks/useContextDocuments.tsx`

Este hook maneja la conversión de attachments a `ContextDocument` que se inyectan en GraphInput:

```typescript
// Pseudo-código del flujo:
const attachmentAdapter = async (attachment: Attachment) => {
  // 1. Si es imagen → convertir a base64 para vision
  if (attachment.type === "image") {
    return {
      type: "image",
      data: base64Data,
      metadata: { filename, mimeType }
    };
  }

  // 2. Si es audio/video → subir a Supabase
  if (isAudioOrVideo(attachment.file.type)) {
    const { path } = await uploadToSupabase(attachment.file);

    // 3. Llamar API de transcripción
    const response = await fetch("/api/whisper/audio", {
      method: "POST",
      body: JSON.stringify({ path })
    });

    const { text } = await response.json();

    // 4. Retornar como texto transcrito
    return {
      type: "text",
      data: text,
      metadata: {
        source: "audio_transcription",
        filename: attachment.file.name
      }
    };
  }

  // 5. Si es documento → usar Firecrawl o similar
  // ...
};
```

#### Tipos MIME soportados

```typescript
// Audio:
"audio/mpeg"       // MP3
"audio/wav"        // WAV
"audio/mp4"        // M4A
"audio/ogg"        // OGG

// Video (se extrae audio):
"video/mp4"        // MP4
"video/quicktime"  // MOV
"video/x-msvideo"  // AVI
```

---

### D. Inyección en GraphInput

**Archivo:** `src/contexts/GraphContext.tsx`

```typescript
// En la función streamMessage:
const contextDocuments = await processAttachments(attachments);

const input: GraphInput = {
  messages: [...],
  artifact: {...},
  // Documentos de contexto (incluye transcripciones)
  contextDocuments,
};
```

**Estructura de ContextDocument:**

```typescript
export interface ContextDocument {
  name: string;              // "audio_transcription_meeting.mp3"
  type: "text" | "image";
  data: string;              // Texto transcrito o base64 de imagen
  metadata?: {
    source?: "audio_transcription" | "firecrawl" | "upload";
    url?: string;
    filename?: string;
  };
}
```

El LLM recibe estos documentos como parte del contexto y puede referenciarlos en su respuesta.

---

## Variables de Entorno Requeridas

```bash
# Groq API
GROQ_API_KEY=gsk_...

# Supabase Storage (para uploads temporales)
NEXT_PUBLIC_SUPABASE_URL_DOCUMENTS=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_DOCUMENTS=eyJhbGc...

# Feature flag (opcional)
NEXT_PUBLIC_GROQ_ENABLED=true
```

---

## Costos y Límites

### Groq Whisper Pricing (2026)
- **Modelo:** `distil-whisper-large-v3-en`
- **Costo:** ~$0.05 por hora de audio
- **Límite:** 100 requests/min (tier gratuito)
- **Latencia:** ~5-10 segundos para 1 min de audio

### Supabase Storage
- **Gratuito:** 1GB storage + 2GB bandwidth
- **Pro:** $0.021/GB storage + $0.09/GB bandwidth
- **Retención:** Archivos eliminados inmediatamente post-transcripción

---

## Manejo de Errores

```typescript
try {
  const transcription = await groq.audio.transcriptions.create({...});
  return { success: true, text: transcription.text };
} catch (error: any) {
  // Log para debugging
  console.error("Transcription failed:", error);

  // Intentar limpiar archivo de todos modos
  await supabase.storage.from("documents").remove([path]).catch(() => {});

  return NextResponse.json({
    error: "Failed to transcribe audio. " + error.message
  }, { status: 500 });
}
```

**Errores comunes:**
1. **GROQ_API_KEY missing:** Retornar 400 con mensaje claro
2. **Formato no soportado:** Validar MIME type antes de upload
3. **Archivo muy grande:** Supabase tiene límite de 50MB (configurable)
4. **Rate limit de Groq:** Implementar retry con exponential backoff

---

## Cómo Reactivar para Contract Drafter

### 1. Feature Flag

```typescript
// src/lib/feature-flags.ts
export const FEATURES = {
  AUDIO_TRANSCRIPTION: process.env.NEXT_PUBLIC_AUDIO_ENABLED === "true",
  // ...
};

// En ComposerAddAttachment:
if (!FEATURES.AUDIO_TRANSCRIPTION) {
  // Ocultar botón de attachment o filtrar tipos de archivo
  acceptedFileTypes = acceptedFileTypes.filter(t => !isAudioOrVideo(t));
}
```

### 2. Configuración de Supabase

```sql
-- Crear bucket para documentos temporales
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Política de acceso (solo authenticated users)
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can download own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

### 3. Multi-idioma para Contract Drafter

```typescript
// Detectar idioma del contrato y pasar a Whisper
const contractLanguage = getContractLanguage(artifact);

const transcription = await groq.audio.transcriptions.create({
  file,
  model: "whisper-large-v3",  // Soporte multi-idioma
  language: contractLanguage,  // "es", "pt", "en", etc.
  temperature: 0.0,
});
```

---

## Mejoras Futuras

### A. Diarización (Speaker Identification)

Para reuniones con múltiples partes:

```typescript
// Usar modelo con diarización (no disponible en Groq aún)
const transcription = await whisper.transcribe({
  file,
  diarize: true,
  num_speakers: 2,  // Comprador y proveedor
});

// Output:
// [Speaker 1]: "Necesitamos plazo de entrega de 30 días"
// [Speaker 2]: "Podemos comprometernos a 45 días"
```

### B. Timestamps para Navegación

```typescript
const transcription = await groq.audio.transcriptions.create({
  file,
  response_format: "verbose_json",  // Incluye timestamps
});

// Output:
// {
//   text: "...",
//   segments: [
//     { start: 0.0, end: 5.2, text: "Necesitamos..." },
//     { start: 5.2, end: 10.8, text: "Podemos comprometernos..." }
//   ]
// }
```

### C. Extracción Automática de Cláusulas

```typescript
// Post-procesamiento con LLM
const extractedClauses = await llm.invoke({
  system: "Extrae compromisos contractuales de esta transcripción",
  user: transcription.text,
});

// Sugerir cláusulas basadas en compromisos identificados
```

---

## Alternativas Consideradas

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| **OpenAI Whisper** | Calidad ligeramente mejor | Más lento (30-60s), más caro | ❌ No elegido |
| **Assembly AI** | Diarización incluida | Más caro ($0.15/hr) | ❌ No elegido |
| **Groq Whisper** | **10-100x más rápido**, económico | Solo inglés (distil model) | ✅ **Elegido** |
| **Deepgram** | Real-time streaming | Más complejo integrar | ⏳ Considerar futuro |

---

## Referencias

- **API Route:** `src/app/api/whisper/audio/route.ts`
- **Attachments UI:** `src/components/assistant-ui/attachment.tsx`
- **Adapter Hook:** `src/hooks/useContextDocuments.tsx`
- **Groq SDK:** `groq-sdk` package
- **Supabase Storage:** [Docs](https://supabase.com/docs/guides/storage)
- **Whisper Model:** [Groq Models](https://console.groq.com/docs/models)

---

## Conclusión

La implementación de transcripción de audio es **esencial para Contract Drafter** y debe ser reactivada en Sprint 2 o 3. El patrón actual es robusto y puede extenderse para:

1. Transcribir reuniones de negociación
2. Convertir notas de voz en cláusulas
3. Extraer compromisos de minutas grabadas
4. Generar contratos desde conversaciones grabadas

La arquitectura actual (Supabase + Groq) es escalable y cost-effective. Solo requiere feature flag para habilitar/deshabilitar fácilmente.
