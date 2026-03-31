# ADR 001: Web Search Implementation Pattern

**Status:** Documentado para referencia
**Fecha:** 2026-03-31
**Contexto:** Documentación de la implementación existente antes de adaptar para Contract Drafter

---

## Resumen

La funcionalidad de Web Search permite a los usuarios habilitar búsqueda web durante la conversación. Los resultados aparecen en un panel lateral deslizable con animaciones fluidas, y el contexto de búsqueda se inyecta automáticamente en los mensajes del LLM.

## Arquitectura

### 1. Flujo de Datos

```
UsuarioToggleWebSearch → GraphContext.searchEnabled → LangGraph
                ↓
        GraphInput.webSearchEnabled = true
                ↓
        LangGraph ejecuta búsqueda
                ↓
        Retorna AIMessage con additional_kwargs:
            - webSearchResults: SearchResult[]
            - webSearchStatus: "searching" | "done"
                ↓
        WebSearchResults component detecta cambio
                ↓
        Abre panel lateral y renderiza resultados
```

### 2. Estructura de Componentes

```
src/components/
├── chat-interface/
│   └── composer-actions-popout.tsx    # Toggle button (Globe icon)
├── web-search-results/
│   ├── index.tsx                      # Panel lateral principal
│   └── loading-cards.tsx              # Skeleton loading state
└── contexts/
    └── GraphContext.tsx               # Estado searchEnabled
```

---

## Implementación Detallada

### A. Estado Global (GraphContext)

**Archivo:** `src/contexts/GraphContext.tsx:144`

```typescript
const [searchEnabled, setSearchEnabled] = useState(false);

// Expuesto en el contexto:
{
  searchEnabled: boolean;
  setSearchEnabled: Dispatch<SetStateAction<boolean>>;
}

// Al hacer streaming, se inyecta en GraphInput:
const input: GraphInput = {
  // ... otros params
  webSearchEnabled: searchEnabled,
};
```

**Propósito:** Estado global que persiste entre mensajes. Cuando está habilitado, TODOS los mensajes subsecuentes incluyen `webSearchEnabled: true`.

---

### B. Toggle Button (Composer Actions)

**Archivo:** `src/components/chat-interface/composer-actions-popout.tsx:98-107`

```typescript
{searchEnabled && (
  <TooltipIconButton
    tooltip="Web search"
    variant="ghost"
    className="size-7 flex-shrink-0 bg-blue-100 hover:bg-blue-100"
    onClick={() => setSearchEnabled((p) => !p)}
  >
    <Globe />
  </TooltipIconButton>
)}
```

**UX:**
- El botón `Globe` aparece cuando `searchEnabled=true` (con fondo azul)
- Al expandir el popout, también aparece si `searchEnabled=false`
- Toggle persiste entre mensajes hasta que el usuario lo desactive

**Animación:**
- Container con `motion.div` de framer-motion
- Ancho dinámico basado en estados: `40px` → `80px` → `120px` → `160px`
- Transición spring con `stiffness: 500, damping: 30`

---

### C. Panel Lateral de Resultados

**Archivo:** `src/components/web-search-results/index.tsx`

#### Estado Local

```typescript
const [status, setStatus] = useState<"searching" | "done">("searching");
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
const [webSearchResultsId, setWebSearchResultsId] = useQueryState(
  WEB_SEARCH_RESULTS_QUERY_PARAM
);
```

**Query Param:** Usa `nuqs` para sincronizar estado con URL (`?webSearchResultsId=msg-123`)

#### Detección de Resultados

```typescript
useEffect(() => {
  // 1. Buscar mensaje con ID del query param
  const webResultsMessage = messages.find(
    (message) => message.id === webSearchResultsId
  ) || messages.find(
    (message) => message.id?.startsWith("web-search-results-")
  );

  // 2. Extraer resultados de additional_kwargs
  const searchResults = webResultsMessage.additional_kwargs
    ?.webSearchResults as SearchResult[];

  const status = webResultsMessage.additional_kwargs?.webSearchStatus || "searching";

  // 3. Actualizar estado local
  setSearchResults(searchResults || []);
  setStatus(status);
}, [webSearchResultsId, messages]);
```

**Contrato con LangGraph:**
- El nodo de LangGraph que ejecuta búsqueda debe retornar un `AIMessage` con:
  - `id`: Identificador único (ej: `web-search-results-${Date.now()}`)
  - `additional_kwargs.webSearchResults`: Array de `SearchResult`
  - `additional_kwargs.webSearchStatus`: `"searching" | "done"`

#### Animaciones

```typescript
<motion.div
  className="flex flex-col gap-6 w-full max-w-md p-5 border-l-[1px]"
  initial={{ x: "100%", opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: "100%", opacity: 0 }}
  transition={{
    type: "spring",
    stiffness: 300,
    damping: 30,
  }}
>
```

**UX:**
- Panel entra desde la derecha (slide-in)
- Ancho fijo `max-w-md` (448px)
- Borde izquierdo + sombra interior para profundidad
- `overflow-y-auto` con scrollbar personalizado

#### SearchResultCard

**Features:**
- Click-to-expand para ver contenido completo
- `line-clamp-3` por defecto (collapsed)
- `AnimatePresence` para transición suave de altura
- Links externos con `target="_blank" rel="noopener noreferrer"`
- Metadata: título, autor, fecha de publicación

```typescript
<CardContent className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
  <AnimatePresence initial={false}>
    <motion.p
      key={expanded ? "expanded" : "collapsed"}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn("text-pretty text-sm", !expanded ? "line-clamp-3" : "")}
    >
      {result.pageContent}
    </motion.p>
  </AnimatePresence>
</CardContent>
```

---

## Tipos de Datos

**Archivo:** `packages/shared/src/types.ts`

```typescript
export interface SearchResult {
  id: string;
  pageContent: string;
  metadata?: {
    title?: string;
    url?: string;
    author?: string;
    publishedDate?: string;
  };
}
```

---

## Cómo Replicar Este Patrón

### Para implementar ClauseSelector (o cualquier panel lateral similar):

1. **Estado en GraphContext:**
   ```typescript
   const [clauseSelectorOpen, setClauseSelectorOpen] = useState(false);
   const [selectedClauses, setSelectedClauses] = useState<Clause[]>([]);
   ```

2. **Toggle en composer-actions-popout:**
   ```typescript
   <TooltipIconButton
     tooltip="Cláusulas"
     onClick={() => setClauseSelectorOpen((p) => !p)}
   >
     <FileText /> {/* o Scale para legal */}
   </TooltipIconButton>
   ```

3. **Componente de Panel:**
   - Copiar estructura de `web-search-results/index.tsx`
   - Cambiar `SearchResultCard` por `ClauseCard`
   - Usar mismas animaciones (`motion.div` con slide-in)
   - Implementar loading skeleton similar a `loading-cards.tsx`

4. **Integración con LangGraph:**
   ```typescript
   // En GraphInput:
   selectedClauseIds?: string[];

   // Al hacer streaming:
   const input: GraphInput = {
     selectedClauseIds: selectedClauses.map(c => c.id),
   };
   ```

5. **API Backend:**
   - Crear `/api/clauses/route.ts` para fetch de cláusulas
   - Si es necesario, usar query params para filtros (categoría, tipo de contrato)

---

## Ventajas de Este Patrón

1. **Separación de concerns:**
   - Estado global en Context
   - UI en componentes presentacionales
   - Lógica de búsqueda en LangGraph

2. **UX fluida:**
   - Animaciones con framer-motion
   - Loading states claros
   - Panel no bloquea interacción con chat

3. **Type-safe:**
   - Tipos compartidos en `@opencanvas/shared`
   - TypeScript end-to-end

4. **URL persistence:**
   - Query params con `nuqs`
   - Sharable links

---

## Consideraciones para Contract Drafter

### Diferencias clave con ClauseSelector:

| Aspecto | Web Search | ClauseSelector |
|---------|------------|----------------|
| **Trigger** | Toggle persiste entre mensajes | Abrir panel → seleccionar → insertar → cerrar |
| **Data source** | LangGraph búsqueda en tiempo real | API de CLM (pre-existente) |
| **Interacción** | Solo lectura | Selección múltiple + inserción |
| **Validación** | N/A | Validar compatibilidad con rules engine |

### Adaptaciones necesarias:

1. **Múltiple selección:**
   ```typescript
   const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>([]);
   ```

2. **Botón de inserción:**
   ```typescript
   <Button onClick={() => {
     streamMessage({ selectedClauseIds });
     setClauseSelectorOpen(false);
   }}>
     Insertar {selectedClauseIds.length} cláusula(s)
   </Button>
   ```

3. **Preview expandible:**
   - Similar a `SearchResultCard` pero con checkbox
   - Mostrar variables a completar
   - Indicador visual de incompatibilidades

4. **Categorías navegables:**
   - Agregar tabs o sidebar de categorías
   - Filtrado por tipo de contrato
   - Búsqueda por texto

---

## Referencias

- **Componentes:** `src/components/web-search-results/`
- **Estado:** `src/contexts/GraphContext.tsx:79-80, 144`
- **Toggle:** `src/components/chat-interface/composer-actions-popout.tsx:98-140`
- **Constante:** `src/constants.ts` → `WEB_SEARCH_RESULTS_QUERY_PARAM`
- **Tipos:** `packages/shared/src/types.ts` → `SearchResult`

---

## Conclusión

Este patrón proporciona una base sólida para implementar paneles laterales interactivos con búsqueda/selección de entidades externas. La arquitectura es escalable, type-safe, y mantiene una UX fluida con animaciones apropiadas.

Para Contract Drafter, el ClauseSelector seguirá esta misma arquitectura pero agregará:
- Selección múltiple
- Validación de reglas
- Inserción en posición específica del documento
- Integración con motor de reglas para sugerencias
