# ADR 006: Contract Toolbar and Rules Fallback

**Status:** Implementado  
**Fecha:** 2026-03-31  
**Contexto:** Adaptación del toolbar flotante para operaciones contractuales sobre drafts markdown

---

## Resumen

Se mantuvo el patrón del toolbar flotante del producto original, pero reemplazando acciones genéricas por operaciones de drafting contractual:
- `validate`
- `suggest`
- `simplify`
- `formalize`
- `addParty`

Las acciones están pensadas para trabajar sobre el draft completo, no sobre código ni sobre transformaciones genéricas de writing assistant.

---

## Decisión

Se decidió un toolbar **contract-first** con dos tipos de ejecución:

1. **Acciones de reglas**  
   Usan BFF (`/api/rules/validate`, `/api/rules/suggest`) y pueden caer a heurísticas locales.

2. **Acciones de transformación de texto**  
   Ocurren localmente y generan una nueva versión del artifact, preservando historial.

---

## Estructura

```text
src/components/artifacts/actions_toolbar/contract/
├── index.tsx
├── draft-actions.tsx
├── clause-actions.tsx
└── validation-status.tsx
```

Helpers en:

```text
src/lib/contracts/draft-tools.ts
```

---

## Principios adoptados

### 1. El toolbar no depende de agentes para ser útil

Las transformaciones de lenguaje y la inserción de partes no se bloquean esperando LangGraph o un rules engine real.

### 2. Las reglas tienen fallback explícito

Si `RULES_ENGINE_URL` no está configurado o responde con error:
- `/api/rules/validate` y `/api/rules/suggest` usan heurísticas locales
- la UI sigue respondiendo

### 3. Las acciones generan nuevas versiones

El artifact no se sobreescribe destructivamente. Cada acción contractual puede producir una nueva versión del draft, lo que respeta el patrón de historial existente en canvas.

---

## Acciones implementadas

| Acción | Tipo | Ejecución actual |
|--------|------|------------------|
| `validate` | Rules | BFF + fallback local |
| `suggest` | Rules | BFF + fallback local |
| `simplify` | Text transform | Local |
| `formalize` | Text transform | Local |
| `addParty` | Draft scaffold | Local |

---

## Razones

- El toolbar era un patrón probado del core de la webapp.
- El draft contractual necesita operaciones rápidas, frecuentes y repetibles.
- Las transformaciones locales son suficientemente buenas para MVP y evitan latencia innecesaria.
- Las validaciones sí merecen una abstracción dedicada porque evolucionarán hacia Rules Engine real.

---

## Consecuencias

### Positivas

- UX rápida y consistente con el canvas existente.
- El historial de versiones se mantiene.
- La migración a services backend puede hacerse acción por acción.

### Tradeoffs

- Las transformaciones locales son heurísticas, no semánticas.
- La precisión de `suggest` y `validate` depende del fallback hasta conectar el motor real.

---

## Archivos clave

- `src/components/artifacts/actions_toolbar/contract/index.tsx`
- `src/components/artifacts/actions_toolbar/contract/draft-actions.tsx`
- `src/components/artifacts/actions_toolbar/contract/clause-actions.tsx`
- `src/components/artifacts/actions_toolbar/contract/validation-status.tsx`
- `src/app/api/rules/validate/route.ts`
- `src/app/api/rules/suggest/route.ts`
- `src/lib/contracts/draft-tools.ts`

---

## Recomendación futura

El próximo salto natural es reemplazar gradualmente heurísticas locales por:
- Rules Engine real para compatibilidad y suggestions
- nodos de LangGraph para operaciones que dependan de contexto conversacional o reordenamiento estructural del draft
