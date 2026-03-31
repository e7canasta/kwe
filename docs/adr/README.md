# ADR Index

## Históricos

| ADR | Tema | Estado |
|-----|------|--------|
| `001` | Web search implementation pattern | Referencia histórica |
| `002` | Audio transcription (Whisper/Groq) | Referencia histórica |
| `003` | Quick actions toolbar pattern original | Referencia histórica / patrón base |
| `004` | Firecrawl document scraping | Referencia histórica |

## Activos para Contract Drafter

| ADR | Tema | Estado |
|-----|------|--------|
| `005` | Clause Selector y draft insertion | Implementado con fallback local |
| `006` | Contract Toolbar y rules fallback | Implementado |
| `007` | Requests Panel y thread seeding | Implementado |
| `008` | Patrón core de estado, worker y BFF en `apps/web` | Recomendado para cualquier feature nueva |
| `009` | `/api/contracts` mock-first persistence y proxy CLM | Implementado con fallback local |
| `010` | Relación `request -> thread -> contract` y metadata operativa | Implementado |
| `011` | Persistencia on-demand y export desde el draft activo | Implementado |
| `012` | Contracts view en Workspace y reapertura de drafts persistidos | Implementado |

## Nota

Los ADRs `001` a `004` documentan patrones del fork original o features removidas. Siguen siendo útiles para entender decisiones previas, pero no describen el producto activo del MVP contractual.
