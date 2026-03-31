# ADR 003: Quick Actions Toolbar Pattern

**Status:** Adaptar para Contract Drafter - Mantener patrón, cambiar acciones
**Fecha:** 2026-03-31
**Contexto:** Documentación del patrón de toolbar flotante con acciones rápidas sobre el artifact

---

## Resumen

El Quick Actions Toolbar es un botón flotante en la esquina inferior derecha del canvas que se expande para mostrar acciones predefinidas sobre el artifact (traducir, ajustar longitud, añadir emojis, etc.). Al seleccionar una acción, se envía un `GraphInput` con parámetros específicos al LLM para modificar el artifact.

## Casos de Uso para Contract Drafter

Reemplazar acciones genéricas por acciones específicas de contratos:

1. **Validar compatibilidad** - Verificar que las cláusulas seleccionadas sean compatibles
2. **Sugerir cláusulas** - Recomendar cláusulas basadas en contexto
3. **Simplificar lenguaje** - Convertir legalese a lenguaje más claro
4. **Formalizar** - Convertir texto informal en lenguaje legal formal
5. **Agregar parte** - Insertar nueva parte contractual (comprador, garante, etc.)
6. **Link a anexo** - Agregar referencia a otro contrato o anexo (adaptación del patrón "emojis")

---

## Arquitectura

### 1. Flujo de Interacción

```
Usuario hace click en botón flotante (Magic Pencil icon)
        ↓
Toolbar se expande mostrando opciones (translate, length, emojis, etc.)
        ↓
Usuario selecciona opción
        ↓
        ├─ Si tiene sub-opciones → Mostrar sub-menú
        │   ↓
        │   Usuario elige sub-opción (ej: idioma español)
        │   ↓
        └─ Si es acción directa (ej: emojis) → Ejecutar inmediatamente
        ↓
Llamar streamMessage({ [param]: value })
        ↓
LangGraph procesa → Modifica artifact → Retorna actualización
        ↓
Canvas se actualiza con nuevo contenido
```

### 2. Estructura de Componentes

```
src/components/artifacts/actions_toolbar/
├── index.tsx                    # Toolbar principal (Open Canvas)
├── text/
│   ├── index.tsx               # ActionsToolbar para markdown
│   ├── TranslateOptions.tsx    # Sub-menú de idiomas
│   ├── ReadingLevelOptions.tsx # Sub-menú de niveles de lectura
│   └── LengthOptions.tsx       # Slider de longitud
├── code/
│   ├── index.tsx               # Toolbar para código (ELIMINAR)
│   └── PortToLanguage.tsx      # (ELIMINAR)
└── custom/
    ├── index.tsx               # Acciones custom del usuario
    ├── FullPrompt.tsx          # Input de prompt completo
    └── NewCustomQuickActionDialog.tsx
```

**Para Contract Drafter:**
```
src/components/artifacts/actions_toolbar/
├── index.tsx                    # Toolbar principal (re-export)
└── contract/
    ├── index.tsx               # ContractToolbar
    ├── ClauseActions.tsx       # Acciones sobre cláusula seleccionada
    ├── DraftActions.tsx        # Acciones sobre todo el draft
    ├── ValidationStatus.tsx    # Indicador de validación
    └── QuickReference.tsx      # Links a anexos/contratos (reemplaza emojis)
```

---

## Implementación Detallada

### A. Toolbar Principal (Text)

**Archivo:** `src/components/artifacts/actions_toolbar/text/index.tsx`

```typescript
const toolbarOptions: ToolbarOption[] = [
  {
    id: "translate",
    tooltip: "Translate",
    icon: <Languages className="w-[26px] h-[26px]" />,
    component: (props) => <TranslateOptions {...props} />,
  },
  {
    id: "readingLevel",
    tooltip: "Reading level",
    icon: <BookOpen className="w-[26px] h-[26px]" />,
    component: (props) => <ReadingLevelOptions {...props} />,
  },
  {
    id: "adjustLength",
    tooltip: "Adjust the length",
    icon: <SlidersVertical className="w-[26px] h-[26px]" />,
    component: (props) => <LengthOptions {...props} />,
  },
  {
    id: "addEmojis",
    tooltip: "Add emojis",
    icon: <SmilePlus className="w-[26px] h-[26px]" />,
    component: null,  // Acción directa, sin sub-menú
  },
];
```

#### Estados Locales

```typescript
const [isExpanded, setIsExpanded] = useState(false);      // Toolbar expandido
const [activeOption, setActiveOption] = useState<string | null>(null); // Sub-menú activo
```

#### Lógica de Expansión

```typescript
const toggleExpand = (event: React.MouseEvent) => {
  event.stopPropagation();
  if (isTextSelected) return;  // Deshabilitar si hay texto seleccionado
  setIsExpanded(!isExpanded);
  setActiveOption(null);
};
```

**UX Crítica:** El toolbar se DESHABILITA cuando hay texto seleccionado en el editor, porque seleccionar texto implica que se usará la toolbar contextual del editor (BlockNote/CodeMirror).

#### Manejo de Opciones

```typescript
const handleOptionClick = async (event: React.MouseEvent, optionId: string) => {
  event.stopPropagation();

  if (optionId === "addEmojis") {
    // Acción directa → cerrar toolbar y ejecutar
    setIsExpanded(false);
    setActiveOption(null);
    await streamMessage({ regenerateWithEmojis: true });
  } else {
    // Mostrar sub-menú
    setActiveOption(optionId);
  }
};
```

#### Renderizado Condicional

```typescript
{isExpanded ? (
  <div className="flex flex-col gap-3 items-center w-full border-[1px] border-gray-200 rounded-3xl py-4 px-3">
    {activeOption && activeOption !== "addEmojis"
      ? // Mostrar sub-menú activo
        toolbarOptions
          .find((option) => option.id === activeOption)
          ?.component?.({ ...props, handleClose })
      : // Mostrar lista de opciones
        toolbarOptions.map((option) => (
          <TooltipIconButton
            key={option.id}
            tooltip={option.tooltip}
            onClick={async (e) => await handleOptionClick(e, option.id)}
          >
            {option.icon}
          </TooltipIconButton>
        ))}
  </div>
) : (
  // Botón colapsado
  <TooltipIconButton tooltip="Writing tools">
    <MagicPencilSVG />
  </TooltipIconButton>
)}
```

---

### B. Sub-Menús de Opciones

#### 1. TranslateOptions (Selección de Idioma)

**Archivo:** `src/components/artifacts/actions_toolbar/text/TranslateOptions.tsx`

```typescript
const handleSubmit = async (language: LanguageOptions) => {
  props.handleClose();  // Cerrar toolbar
  await streamMessage({ language });  // Enviar al LLM
};

return (
  <div className="flex flex-col gap-3 items-center w-full">
    <TooltipIconButton tooltip="English" onClick={() => handleSubmit("english")}>
      <UsaFlag />
    </TooltipIconButton>
    <TooltipIconButton tooltip="Spanish" onClick={() => handleSubmit("spanish")}>
      <SpanishFlag />
    </TooltipIconButton>
    {/* ... más idiomas */}
  </div>
);
```

**Pattern:**
1. Mostrar lista vertical de opciones (banderas/iconos)
2. Al click → cerrar toolbar + enviar `GraphInput` con parámetro específico
3. LangGraph recibe y ejecuta transformación

#### 2. LengthOptions (Slider Vertical)

**Archivo:** `src/components/artifacts/actions_toolbar/text/LengthOptions.tsx`

```typescript
const [value, setValue] = useState([3]);  // Default: longitud actual

<Slider
  defaultValue={[3]}
  max={5}
  min={1}
  step={1}
  value={value}
  onValueChange={(newValue) => {
    setValue(newValue);
    setOpen(true);  // Mostrar tooltip con label
  }}
  onValueCommit={async (v) => {
    setOpen(false);
    switch (v[0]) {
      case 1: await handleSubmit("shortest"); break;
      case 2: await handleSubmit("short"); break;
      case 3: break;  // Sin cambios
      case 4: await handleSubmit("long"); break;
      case 5: await handleSubmit("longest"); break;
    }
  }}
  orientation="vertical"
  className="h-[180px] w-[26px]"
/>
```

**Pattern:**
- Slider vertical con 5 niveles
- Tooltip dinámico mostrando label al mover
- `onValueCommit` (no `onChange`) para evitar múltiples requests

---

### C. Integración con GraphInput

**Tipos en:** `packages/shared/src/types.ts`

```typescript
export interface GraphInput {
  // ... otros campos
  language?: LanguageOptions;
  artifactLength?: ArtifactLengthOptions;
  readingLevel?: ReadingLevelOptions;
  regenerateWithEmojis?: boolean;
  customAction?: string;  // Para acciones custom
}

export type LanguageOptions = "english" | "spanish" | "french" | "mandarin" | "hindi";
export type ArtifactLengthOptions = "shortest" | "short" | "long" | "longest";
export type ReadingLevelOptions = "child" | "teenager" | "college" | "phd";
```

**En LangGraph (apps/agents):**

```typescript
// Node que maneja modificaciones
async function modifyArtifact(state: GraphState) {
  const { language, artifactLength, readingLevel, regenerateWithEmojis } = state;

  if (language) {
    return await translateArtifact(state, language);
  }
  if (artifactLength) {
    return await adjustLength(state, artifactLength);
  }
  if (regenerateWithEmojis) {
    return await addEmojis(state);
  }
  // ...
}
```

---

### D. Posicionamiento y Estilos

```typescript
<div
  ref={toolbarRef}
  className={cn(
    "fixed bottom-4 right-4 transition-all duration-300 ease-in-out text-black flex flex-col items-center justify-center bg-white",
    isExpanded
      ? "w-fit-content min-h-fit rounded-3xl"
      : "w-12 h-12 rounded-full"
  )}
>
```

**Características:**
- `fixed bottom-4 right-4` → Siempre visible en esquina inferior derecha
- Transición suave entre estados (300ms ease-in-out)
- Colapsado: círculo de 48x48px
- Expandido: ancho automático, altura según contenido
- Border radius cambia: `rounded-full` → `rounded-3xl`

**Detección de clicks fuera:**

```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
      setIsExpanded(false);
      setActiveOption(null);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);
```

---

## Adaptación para Contract Drafter

### Nuevas Acciones para ContractToolbar

```typescript
const contractActions: ContractAction[] = [
  {
    id: "validate",
    tooltip: "Validar compatibilidad",
    icon: <CheckCircle className="w-[26px] h-[26px]" />,
    component: null,  // Acción directa
    action: async () => {
      // Llamar rules engine
      const validation = await fetch("/api/rules/validate", {
        method: "POST",
        body: JSON.stringify({
          clauseIds: getCurrentClauseIds(),
          contractType: artifact.contractType,
        }),
      });
      // Mostrar resultados en toast/modal
    },
  },
  {
    id: "suggest",
    tooltip: "Sugerir cláusulas",
    icon: <Lightbulb className="w-[26px] h-[26px]" />,
    component: null,
    action: async () => {
      await streamMessage({ requestClauseSuggestions: true });
    },
  },
  {
    id: "simplify",
    tooltip: "Simplificar lenguaje",
    icon: <FileText className="w-[26px] h-[26px]" />,
    component: null,
    action: async () => {
      await streamMessage({ simplifyLegalLanguage: true });
    },
  },
  {
    id: "formalize",
    tooltip: "Formalizar",
    icon: <Scale className="w-[26px] h-[26px]" />,
    component: null,
    action: async () => {
      await streamMessage({ formalizeLegalLanguage: true });
    },
  },
  {
    id: "addParty",
    tooltip: "Agregar parte",
    icon: <Users className="w-[26px] h-[26px]" />,
    component: (props) => <AddPartyOptions {...props} />,
  },
  {
    id: "linkAnnex",
    tooltip: "Link a anexo/contrato",
    icon: <Link className="w-[26px] h-[26px]" />,
    component: (props) => <QuickReferenceSelector {...props} />,
  },
];
```

### Sub-Menú: AddPartyOptions

```typescript
// src/components/artifacts/actions_toolbar/contract/AddPartyOptions.tsx
const partyTypes = [
  { value: "buyer", label: "Comprador", icon: <Building /> },
  { value: "supplier", label: "Proveedor", icon: <Truck /> },
  { value: "guarantor", label: "Garante", icon: <Shield /> },
  { value: "witness", label: "Testigo", icon: <Eye /> },
];

export function AddPartyOptions({ streamMessage, handleClose }: Props) {
  const handleSubmit = async (partyType: PartyType) => {
    handleClose();
    await streamMessage({ addParty: partyType });
  };

  return (
    <div className="flex flex-col gap-3">
      {partyTypes.map((party) => (
        <TooltipIconButton
          key={party.value}
          tooltip={party.label}
          onClick={() => handleSubmit(party.value)}
        >
          {party.icon}
        </TooltipIconButton>
      ))}
    </div>
  );
}
```

### Sub-Menú: QuickReferenceSelector (Reemplazo de Emojis)

```typescript
// src/components/artifacts/actions_toolbar/contract/QuickReferenceSelector.tsx
interface Reference {
  id: string;
  title: string;
  type: "contract" | "annex" | "policy";
}

export function QuickReferenceSelector({ streamMessage, handleClose }: Props) {
  const [references, setReferences] = useState<Reference[]>([]);

  useEffect(() => {
    // Fetch referencias disponibles del CLM
    fetch("/api/contracts/references").then((res) => res.json()).then(setReferences);
  }, []);

  const handleSelectReference = async (ref: Reference) => {
    handleClose();
    await streamMessage({
      insertReference: {
        type: ref.type,
        id: ref.id,
        title: ref.title,
      },
    });
  };

  return (
    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
      {references.map((ref) => (
        <Button
          key={ref.id}
          variant="ghost"
          size="sm"
          onClick={() => handleSelectReference(ref)}
          className="justify-start"
        >
          <FileIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{ref.title}</span>
        </Button>
      ))}
    </div>
  );
}
```

---

## Validación de Estado (Deshabilitar según contexto)

```typescript
// En ContractToolbar
const isTextSelected = props.isTextSelected;
const hasValidationErrors = useGraphContext().validationErrors?.length > 0;
const isStreaming = useGraphContext().isStreaming;

// Deshabilitar toolbar si:
const isDisabled = isTextSelected || isStreaming;

// Cambiar tooltip según estado
const getTooltip = () => {
  if (isTextSelected) return "Deshabilitado mientras hay texto seleccionado";
  if (isStreaming) return "Esperando respuesta del asistente";
  return "Acciones de contrato";
};
```

---

## ValidationStatus Indicator

Agregar indicador visual del estado de validación en el toolbar:

```typescript
// src/components/artifacts/actions_toolbar/contract/ValidationStatus.tsx
export function ValidationStatus() {
  const { validationResult } = useGraphContext();

  if (!validationResult) return null;

  const { valid, errors, warnings } = validationResult;

  return (
    <div className="absolute -top-2 -right-2">
      <Badge variant={valid ? "success" : errors.length ? "destructive" : "warning"}>
        {errors.length > 0 && <AlertCircle className="h-3 w-3 mr-1" />}
        {warnings.length > 0 && !errors.length && <AlertTriangle className="h-3 w-3 mr-1" />}
        {valid && <CheckCircle className="h-3 w-3 mr-1" />}
        {errors.length || warnings.length || 0}
      </Badge>
    </div>
  );
}
```

---

## Tipos para Contract Actions

```typescript
// packages/shared/src/types.ts
export interface GraphInput {
  // Nuevos campos para Contract Drafter:
  requestClauseSuggestions?: boolean;
  simplifyLegalLanguage?: boolean;
  formalizeLegalLanguage?: boolean;
  addParty?: PartyType;
  insertReference?: {
    type: "contract" | "annex" | "policy";
    id: string;
    title: string;
  };
}

export type PartyType = "buyer" | "supplier" | "guarantor" | "witness";
```

---

## Ventajas del Patrón

1. **Discoverable:** Usuario ve todas las acciones disponibles de un vistazo
2. **No invasivo:** No ocupa espacio hasta que se expande
3. **Rápido:** Acciones a 2-3 clicks máximo
4. **Extensible:** Fácil agregar nuevas acciones
5. **Context-aware:** Se puede deshabilitar según estado

---

## Desventajas y Mitigaciones

| Desventaja | Mitigación |
|------------|-----------|
| Puede ocultar contenido del canvas | Posicionar en esquina + hacer semi-transparente al hacer scroll |
| No es obvio para nuevos usuarios | Agregar tour/tooltip en primer uso |
| Muchas opciones → cluttered | Agrupar por categorías con tabs |
| Mobile no tiene hover | Toolbar debe estar always-on en mobile |

---

## Comparación con Otras Alternativas

| Enfoque | Pros | Contras |
|---------|------|---------|
| **Floating toolbar** (actual) | No ocupa espacio, siempre accesible | Puede ocultar contenido |
| **Top toolbar** | Siempre visible, más discoverable | Ocupa espacio permanente |
| **Context menu** (right-click) | No ocupa espacio visual | Requiere conocer shortcut, no mobile-friendly |
| **Slash commands** | Rápido para power users | No discoverable, curva de aprendizaje |

**Decisión:** Mantener floating toolbar para Contract Drafter por balance entre accesibilidad y espacio.

---

## Referencias

- **Toolbar principal:** `src/components/artifacts/actions_toolbar/text/index.tsx`
- **Sub-menús:** `src/components/artifacts/actions_toolbar/text/*.tsx`
- **Iconos:** `lucide-react` + custom SVGs en `src/components/icons/`
- **Tipos:** `packages/shared/src/types.ts` → `GraphInput`, `LanguageOptions`, etc.
- **Magic Pencil icon:** `src/components/icons/magic_pencil.tsx`

---

## Conclusión

El patrón de Quick Actions Toolbar es ideal para Contract Drafter porque:

1. Acciones específicas de dominio son más valiosas que genéricas
2. Validación y sugerencias deben estar a un click
3. Links a referencias externas (anexos, contratos) siguen el patrón de "emojis"
4. La arquitectura existente se puede reutilizar 100%

Solo requiere:
- Reemplazar `toolbarOptions` con `contractActions`
- Crear sub-menús específicos (`AddPartyOptions`, `QuickReferenceSelector`)
- Agregar `ValidationStatus` indicator
- Eliminar acciones genéricas (translate, emojis, reading level)
