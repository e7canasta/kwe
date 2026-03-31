# Plan: Contract Drafter MVP

Estado actualizado al 2026-03-31.

Este documento refleja el estado real de `apps/web`. El plan original ya fue ejecutado en gran parte y además se amplió con capacidades no incluidas inicialmente. La referencia operativa vigente está repartida entre:

- `docs/adr/005-clause-selector-and-draft-insertion.md`
- `docs/adr/006-contract-toolbar-and-rules-fallback.md`
- `docs/adr/007-requests-panel-thread-seeding.md`
- `docs/adr/009-contracts-bff-persistence-pattern.md`
- `docs/adr/010-request-thread-contract-linkage.md`
- `docs/adr/011-active-draft-persistence-and-export.md`
- `docs/adr/012-contracts-workspace-view.md`
- `docs/c4-backend-communication.md`

## Resumen Ejecutivo

| Área | Estado actual | Nota |
|------|---------------|------|
| Artifact markdown-only | Implementado en `apps/web` | El frontend ya trabaja solo con drafts markdown |
| Clause Selector | Implementado con fallback local | Inserción local-first con costura hacia LangGraph |
| Contract Toolbar | Implementado | `validate`, `suggest`, `simplify`, `formalize`, `addParty` |
| Requests | Implementado | Lista, filtros, thread seeding e idempotencia |
| Contracts | Implementado | Persistencia, export y vista `Contracts` en workspace |
| Rules Engine separado | Parcial | Existen `/api/rules/*` con fallback local; servicio real pendiente |
| LangGraph contractual | Parcial | Streaming normal activo; `insertClause` real pendiente |
| Cleanup legacy completo | Parcial | `apps/web` está bastante limpio, `apps/agents` todavía arrastra tipos y flags legacy |

## Arquitectura Actual del MVP

```text
Usuario
  → UI React / Next.js
    → Canvas + Chat + Clause Selector + Requests + Contracts
      → BFF /api/*
        → LangGraph              (chat/streaming y futura inserción contractual)
        → CLM API                (clauses, requests, contracts cuando exista)
        → Rules Engine opcional  (validate/suggest)
        → LangSmith              (runs/feedback)
```

Superficies activas hoy:

- `/api/[..._path]` para proxy a LangGraph
- `/api/clauses/*`
- `/api/rules/*`
- `/api/requests/*`
- `/api/contracts/*`
- `/api/draft/clauses/insert`

## Estado por Fase

### Fase 1: Simplificación del Canvas

**Estado:** Implementado en `apps/web`

Completado:

- artifact solo markdown en frontend
- remoción de `CodeRenderer` y toolbar de código
- simplificación de `ArtifactRenderer`
- eliminación del flujo activo de web search, Firecrawl y Whisper/Groq en `apps/web`
- estado contractual base agregado a `GraphContext`

Gap abierto:

- `apps/agents` todavía conserva tipos y routing del modelo legacy de Open Canvas

### Fase 2: Reemplazar Web Search con Clause Selector

**Estado:** Implementado con fallback local

Completado:

- `src/components/clause-selector/`
- `clauseSelectorOpen` y `selectedClauses` en `GraphContext`
- integración en `composer-actions-popout.tsx`
- validación contractual contra `/api/rules/validate`
- inserción local en el draft con fallback explícito

Pendiente:

- reemplazar el fallback por `insertClause` real en LangGraph

### Fase 3: Quick Actions para Contratos

**Estado:** Implementado

Completado:

- `src/components/artifacts/actions_toolbar/contract/`
- acciones `validate`, `suggest`, `simplify`, `formalize`, `addParty`
- generación de nuevas versiones del artifact
- fallback local para reglas cuando backend no está disponible

### Fase 4: APIs del BFF

**Estado:** Mayormente implementado

Completado:

- `/api/clauses`
- `/api/clauses/[id]`
- `/api/clauses/categories`
- `/api/requests`
- `/api/requests/[id]`
- `/api/contracts`
- `/api/contracts/[id]`
- `/api/contracts/[id]/export`
- `/api/rules/validate`
- `/api/rules/suggest`
- `/api/draft/clauses/insert`

Pendiente:

- backend contractual canónico fuera de `apps/web`
- export binario real en lugar de payload mock
- paquete `rules-engine` separado según el diseño original

### Fase 5: Motor de Reglas

**Estado:** Parcial

Completado:

- rutas BFF para `validate` y `suggest`
- heurísticas locales en `apps/web`
- contrato de integración por `RULES_ENGINE_URL`

Pendiente:

- servicio real separado
- reglas versionadas fuera del frontend
- alineación entre heurística local y backend definitivo

### Fase 6: Panel de Solicitudes Pendientes

**Estado:** Implementado

Completado:

- `src/components/requests-panel/`
- filtros y detalle
- tab `Requests` en `ThreadHistory`
- creación y reapertura idempotente de thread por request

## Trabajo Agregado Sobre el Plan Original

Estas capacidades ya existen y no estaban capturadas en el plan inicial.

### Request → Thread → Contract Linkage

**Estado:** Implementado

Se volvió explícita la relación entre request, thread seedado y draft persistido. La orquestación vive en `src/lib/contracts/request-drafting.ts`.

### Persistencia On-Demand y Export del Draft Activo

**Estado:** Implementado

El export ya no depende de venir desde `Requests`. El draft activo puede persistirse o sincronizarse antes de exportar desde el header del artifact.

### Vista Contracts en Workspace

**Estado:** Implementado

`ThreadHistory` ya expone `Conversations`, `Requests` y `Contracts`, con reapertura de drafts persistidos y relink de `threadId` cuando hace falta.

## Checklist Actualizado

### Foundation

1. [x] Simplificar canvas a markdown-only en `apps/web`
2. [x] Eliminar features no necesarias del producto activo en `apps/web`
3. [x] Crear tipos base de contratos y cláusulas para el frontend contractual

### Clauses

4. [x] API route `/api/clauses`
5. [x] Componente `ClauseSelector`
6. [x] Integrar selector en composer

### Drafting

7. [x] `ContractToolbar` con acciones básicas
8. [~] Nodo `insertClause` real en LangGraph
9. [x] Flujo básico de generación y edición de draft en frontend

### Rules

10. [ ] Crear paquete `rules-engine` separado en el monorepo
11. [x] API route `/api/rules/validate`
12. [x] Integrar validación en el flujo con fallback local

### Requests

13. [x] API route `/api/requests`
14. [x] `RequestsPanel` UI
15. [x] Integración con creación y reapertura de threads

### Contracts

16. [x] API route `/api/contracts`
17. [x] Relación idempotente `request -> thread -> contract`
18. [x] Persistencia on-demand y export desde el draft activo
19. [x] Vista `Contracts` en workspace

## Próximos Pasos Reales

### 1. Alinear `apps/agents` y shared types con el modelo contractual actual

Pendiente en backend/agents:

- eliminar `ArtifactCodeV3`, `ProgrammingLanguageOptions`, `CodeHighlight`
- remover `webSearchEnabled` y `webSearchResults`
- simplificar state y utils al modelo markdown-only
- agregar routing contractual basado en `selectedClauseIds`

### 2. Implementar `insertClause` real en LangGraph

Objetivo:

- resolver cláusulas desde backend
- validar con rules engine o capa contractual equivalente
- devolver artifact actualizado
- mantener fallback local solo como red de seguridad transitoria

### 3. Decidir backend real para reglas y contratos

Hay que cerrar una decisión operativa:

- `RULES_ENGINE_URL` apunta a un servicio real y estable
- o las heurísticas siguen siendo la implementación oficial del MVP

Lo mismo aplica para `/api/contracts`: hoy funciona bien como BFF mock-first, pero todavía no es fuente canónica compartida.

### 4. Limpiar configuración residual

Estado:

- `.env.example` ya refleja variables contractuales vigentes
- se removieron `GROQ_API_KEY` y `FIRECRAWL_API_KEY` del ejemplo de entorno
- se mantuvo `NEXT_PUBLIC_GROQ_ENABLED` porque sigue gobernando modelos de chat, no la transcripción removida

Pendiente:

- revisar si todos los feature flags de proveedores siguen siendo necesarios para el producto final

### 5. Cerrar salud de tooling

Estado actual:

- `yarn typecheck` pasa
- `yarn lint` pasa
- `yarn build` pasa

Nota:

- se eliminó la dependencia rota de `eslint-plugin-unused-imports` del baseline de `apps/web`
- queda un warning de `Browserslist: caniuse-lite is outdated`, pero no bloquea build ni lint

## Plan de Cierre Ejecutable

Objetivo de cierre:

- dejar el flujo contractual operando end-to-end con contrato estable entre `apps/web`, `apps/agents` y `packages/shared`
- mover la inserción contractual desde fallback local a LangGraph sin rediseñar el frontend
- retirar del flujo principal las ramas legacy de code artifacts y web search

### Bloqueadores reales detectados al 2026-03-31

1. `packages/shared/src` y `packages/shared/dist` no están alineados
2. `apps/agents` sigue compilando con tipos y rutas legacy
3. no existe implementación de `insertClause` en `apps/agents`
4. `apps/web` ya expone la costura BFF, pero depende de un upstream todavía inexistente

### Hito A: Alinear `packages/shared`

**Estado:** Pendiente

Hallazgo concreto:

- `../../packages/shared/src/types.ts` ya refleja el modelo markdown-only contractual
- `../../packages/shared/dist/types.d.ts` todavía expone `webSearchEnabled` y `webSearchResults`
- `../../packages/shared/dist/constants.js` todavía exporta defaults y constantes del flujo legacy
- `../../packages/shared/dist/utils/artifacts.d.ts` todavía expone `ArtifactCodeV3` e `isArtifactCodeContent`

Trabajo:

1. reconstruir `packages/shared` para que `dist/` refleje el source actual
2. confirmar que `GraphInput` publicado incluye `selectedClauseIds` e `insertClauseAtPosition`
3. remover del artefacto publicado referencias a code artifacts y web search que ya no existen en `src`
4. validar que `apps/web` y `apps/agents` consumen exactamente el mismo contrato publicado

Criterio de cierre:

- `src/` y `dist/` quedan alineados
- no quedan exports publicados de `ArtifactCodeV3`, `ProgrammingLanguageOptions`, `CodeHighlight`, `webSearchEnabled` ni `webSearchResults`
- cualquier import de `@opencanvas/shared/*` compila sin depender de tipos legacy

### Hito B: Limpiar el grafo de `apps/agents`

**Estado:** Pendiente

Archivos que hoy muestran deuda real:

- `../agents/src/open-canvas/state.ts`
- `../agents/src/open-canvas/index.ts`
- `../agents/src/open-canvas/nodes/generate-path/index.ts`
- `../agents/src/open-canvas/nodes/generate-artifact/utils.ts`
- `../agents/src/open-canvas/nodes/rewrite-artifact/utils.ts`
- `../agents/src/open-canvas/nodes/customAction.ts`
- `../agents/src/open-canvas/nodes/updateArtifact.ts`
- `../agents/src/utils.ts`

Trabajo:

1. quitar del state annotations y campos ligados a code artifacts y web search
2. remover routing por `highlightedCode`, `language`, `artifactLength`, `regenerateWithEmojis`, `readingLevel`, `addComments`, `addLogs`, `portLanguage`, `fixBugs` y `webSearchEnabled`
3. sacar del grafo los nodos `rewriteCodeArtifactTheme`, `webSearch` y `routePostWebSearch`
4. simplificar helpers para trabajar solo con `ArtifactMarkdownV3`
5. dejar `customAction` únicamente para quick actions contractuales todavía vigentes

Criterio de cierre:

- el grafo compila sin ramas de código ni web search
- no quedan referencias activas a `ArtifactCodeV3`, `ProgrammingLanguageOptions`, `CodeHighlight`, `webSearchEnabled` ni `webSearchResults` dentro de `apps/agents/src`
- el flujo base queda reducido a conversación, artifact markdown, quick actions contractuales y futura inserción de cláusulas

### Hito C: Agregar routing contractual en LangGraph

**Estado:** Pendiente

Trabajo:

1. extender el router inicial para detectar `selectedClauseIds`
2. derivar a un nodo contractual dedicado antes de caer en `generateArtifact` o `rewriteArtifact`
3. mantener `insertClauseAtPosition` como hint opcional, no como precondición fuerte
4. devolver errores estructurados si la validación falla o si las cláusulas no existen

Contrato mínimo ya acordado:

- input: `artifact`, `threadId`, `selectedClauseIds`, `insertClauseAtPosition`
- output: `artifact` actualizado y `source: "langgraph"`

Criterio de cierre:

- el router del grafo reconoce el caso contractual sin depender de feature flags del frontend
- las solicitudes con `selectedClauseIds` no pasan por rutas genéricas
- los errores retornan shape estable para que `apps/web` pueda conservar el fallback local solo como red de seguridad

### Hito D: Implementar `insertClause` real

**Estado:** Pendiente

Trabajo:

1. crear el nodo `insertClause` en `apps/agents`
2. resolver `selectedClauseIds` contra la fuente contractual real
3. validar compatibilidad antes de mutar el draft
4. insertar o appendear cláusulas sobre el markdown actual
5. devolver una nueva versión del artifact compatible con `apps/web`
6. mantener `POST /api/draft/clauses/insert` como costura estable sin rediseños extra

Criterio de cierre:

- con `NEXT_PUBLIC_AGENT_CLAUSE_INSERTION_ENABLED=true`, el frontend recibe `200` con artifact actualizado
- una incompatibilidad contractual devuelve error estructurado y no muta el draft
- el fallback local queda reservado para errores transitorios, no como camino principal

### Hito E: Cerrar ownership de Rules y Contracts

**Estado:** Pendiente

Decisiones que faltan:

1. definir si `RULES_ENGINE_URL` será obligatorio en entornos reales o si la heurística local seguirá siendo la implementación oficial del MVP
2. definir si `/api/contracts` sigue como BFF mock-first o pasa a depender de una fuente canónica externa
3. fijar el contrato de autenticación, errores y versionado para estas integraciones

Criterio de cierre:

- una fuente canónica queda documentada para `rules` y `contracts`
- `.env.example` y `docs/c4-backend-communication.md` reflejan la decisión final
- QA puede probar el flujo sin depender de supuestos implícitos sobre mocks

## Checklist de Cierre

### Shared

20. [ ] Regenerar `packages/shared/dist` desde el source contractual actual
21. [ ] Publicar `GraphInput` con `selectedClauseIds` e `insertClauseAtPosition`
22. [ ] Eliminar exports publicados del modelo legacy

### Agents

23. [ ] Limpiar `state.ts` del grafo contractual
24. [ ] Remover ramas y nodos legacy de code/web search
25. [ ] Simplificar helpers a markdown-only
26. [ ] Mantener quick actions solo donde sigan siendo contractuales

### Clause insertion

27. [ ] Agregar routing contractual por `selectedClauseIds`
28. [ ] Implementar nodo `insertClause`
29. [ ] Conectar resolución de cláusulas contra backend/fuente real
30. [ ] Integrar validación previa a la mutación del draft
31. [ ] Devolver artifact actualizado con contrato estable para `apps/web`

### Rollout

32. [ ] Probar `POST /api/draft/clauses/insert` en staging con flag encendido
33. [ ] Mantener fallback local solo para errores transitorios
34. [ ] Actualizar docs operativos una vez cerrado el upstream real
35. [ ] Ejecutar regresión funcional completa de requests, contracts, export e inserción

## Secuencia Recomendada de Ejecución

Orden recomendado:

1. `packages/shared`
2. cleanup de `apps/agents`
3. routing contractual
4. nodo `insertClause`
5. decisión final sobre `rules` y `contracts`
6. rollout con flag y regresión

Razón del orden:

- si `packages/shared/dist` sigue desalineado, el resto del trabajo corre sobre contratos inconsistentes
- limpiar primero el grafo evita implementar `insertClause` sobre rutas legacy que luego habría que volver a tocar
- recién después de eso conviene encender el flag de inserción remota en staging

## Definición Operativa de Cierre

El plan puede considerarse realmente terminado cuando se cumpla todo esto:

- `apps/web` deja de depender del fallback local como camino principal de inserción
- `apps/agents` queda alineado al modelo markdown-only contractual
- `packages/shared` publica un contrato coherente con lo que consumen `web` y `agents`
- `rules` y `contracts` tienen ownership explícito y documentado
- la regresión manual del MVP contractual pasa con el flag remoto activo

## Verificación del MVP

### Verificaciones funcionales prioritarias

1. Crear un draft vacío y abrir `ClauseSelector`
2. Insertar cláusulas compatibles y validar que se agregan al markdown
3. Forzar incompatibilidad y validar error o warning
4. Abrir una request y verificar reapertura idempotente del mismo thread
5. Exportar un draft iniciado fuera de `Requests`
6. Abrir un contrato persistido desde la tab `Contracts`

### Comandos útiles

```bash
yarn typecheck
yarn lint
yarn build
```

## Handoff

### Estado verificado al cierre de sesión

- `apps/web` compila, linta y tipa correctamente
- el crash por `NEXT_PUBLIC_SUPABASE_URL is not defined` quedó resuelto
- si faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, la app cae a modo local/mock auth en lugar de romper
- el producto contractual sigue funcionando como `local-first` para clauses/rules/contracts mientras no exista backend definitivo

### Cambios cerrados en esta sesión

- cleanup de `.env.example` hacia variables contractuales reales
- baseline de lint estabilizado en `apps/web`
- fix de fallback auth/local para middleware y BFF cuando Supabase no está configurado
- actualización de este plan para reflejar estado real y no backlog aspiracional

### Archivos tocados en esta sesión

- `.env.example`
- `.eslintrc.json`
- `package.json`
- `src/hooks/use-toast.ts`
- `src/lib/mock/local-ui.ts`
- `src/lib/supabase/runtime.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/verify_user_server.ts`
- `src/middleware.ts`
- `zany-watching-pixel.md`

### Cómo retomar en una sesión fresca

Punto de arranque recomendado:

1. Leer este archivo y `docs/c4-backend-communication.md`
2. Confirmar que `apps/web` sigue verde con:
   - `yarn typecheck`
   - `yarn lint`
   - `yarn build`
3. Mover el foco a `apps/agents` y `packages/shared`

### Próximo frente recomendado

Para terminar el plan, el siguiente corte real ya no está en `apps/web`.

Orden recomendado:

1. Alinear `packages/shared/src/types.ts` y `apps/agents/src/open-canvas/state.ts`
2. Remover del grafo legacy:
   - code artifacts
   - web search routing
   - quick actions legacy de texto/código
3. Agregar routing contractual por `selectedClauseIds`
4. Implementar `insertClause` real en LangGraph
5. Mantener fallback local del frontend hasta que el nodo contractual quede estable

### Definición práctica de “plan terminado”

Se puede considerar cerrado cuando estén resueltos estos puntos:

- `apps/agents` alineado al modelo markdown-only contractual
- `insertClause` funcionando en LangGraph
- contrato estable entre frontend y backend para clauses/rules/contracts
- sin referencias activas al modelo legacy de Open Canvas en el flujo contractual principal

### Riesgos o notas para la próxima sesión

- `apps/agents` y `packages/shared` quedan fuera del write scope actual de `apps/web`
- la mayor deuda ya no es UI, sino alineación de tipos/graph runtime
- `NEXT_PUBLIC_GROQ_ENABLED` se mantuvo porque hoy gobierna modelos de chat, no la transcripción removida
- queda un warning de `Browserslist: caniuse-lite is outdated`, pero no bloquea nada

## Conclusión

El frontend contractual de `apps/web` ya no está en fase de diseño inicial. El estado real es:

- MVP contractual navegable e integrado
- fallback local explícito para cláusulas y reglas
- persistencia y reapertura de drafts ya resueltas en la UI/BFF
- principal deuda desplazada a `apps/agents`, rules engine real y cleanup final de legacy
