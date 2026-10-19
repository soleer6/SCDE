# Memoria del TFG (frontend) — esqueleto LaTeX

**Estado:** borrador avanzado en redacción. Redactados en prosa: capítulos 1 (introducción), 2 (estado del arte, borradores de Codex revisados e integrados), 3 (análisis) y 4 (diseño), a 2026-10-18. El resto, esqueleto con material factual y marcas `\pendiente{...}` (en rojo en el PDF) para lo que falta redactar o exige dato o decisión del autor. Todo el texto es un borrador que el autor debe revisar.

**No compilado todavía**: la máquina de desarrollo no tiene distribución LaTeX.

## Normativa oficial consultada (17/10/2026)
- *Normativa de Trabajo Fin de Grado* de la EPS-UAM, aprobada en Junta de Centro el
  8/5/2026, en vigor desde el curso 2026-27:
  https://www.uam.es/eps/media/doc/1607037581275/normativa-eps-tfg-20260508.pdf
  (índice de normativa: https://www.uam.es/eps/normativa)
- Infografía TFG curso 2026-27:
  https://www.uam.es/eps/media/doc/1607041777334/tfg-infografia-26-27-estudiantes.pdf

Puntos que afectan a la memoria:
1. **Art. 5.1.1**: la memoria se realiza "según las directrices establecidas en la plataforma
   de TFG" (https://tfg.eps.uam.es, acceso con cuenta UAM) y en el Moodle de la asignatura.
   **No se pudo consultar** (requiere autenticación). → Descargar de ahí la plantilla/directrices
   oficiales y confirmar que coinciden con esta clase.
2. **Art. 5.1.3**: al solicitar la defensa se declara la autoría y que **se han respetado las
   condiciones de uso de herramientas de IA** fijadas por el ED-TFG → consultar esas
   condiciones en la plataforma; ver capítulo 5.5 y apéndice D.
3. **Art. 2.1**: el TFG es individual → la sección 1.3 delimita la aportación frente al TFG
   de backend.
4. **Art. 5.3.4**: aspectos de la rúbrica (contenido teórico/práctico, prototipos y
   resultados, competencias, originalidad y dificultad, calidad de la memoria, autonomía).
5. **Art. 5.2.4**: defensa de ~15 min + 15 min de preguntas.
6. Calendario 2026-27 (infografía): ordinaria S1 08/01–01/02 (solicitud hasta 20/12);
   ordinaria S2 18/05–08/06 (solicitud hasta 11/05); extraordinaria 07/06–28/06
   (solicitud hasta 30/05).

## Plantilla
- Clase `tfgtfmthesisuam` (Eloy Anguiano Rey). Es la que usa la memoria del TFG de backend
  (repo SCDEE, `docs/main.tex`); este esqueleto replica su estructura y sus comandos para que
  ambas memorias sean coherentes.
- Fuente pública: https://github.com/EloyAnguianoRey/tfgtfmthesisuam (última actualización
  2019, sin licencia declarada; por eso **no se copia aquí** el `.cls`). La memoria del backend
  usa opciones y comandos compatibles con esa versión, pero puede usar una versión más reciente:
  pedir al tutor / ED-TFG la versión vigente.
- Para compilar: copiar `tfgtfmthesisuam.cls` (y sus logos) junto a `main.tex`, o subir todo a
  Overleaf (la clase tiene opción `overleaf`).

## Receta de compilación
```
pdflatex main ; bibtex main ; makeglossaries main ; makeindex -s main.ist main ; pdflatex main ; pdflatex main
```

## De dónde sale cada capítulo
| Capítulo | Fuente técnica |
|---|---|
| 3 Análisis | `docs/tfg/01-analysis.md`, `docs/tfg/03-backend-gaps.md`, `docs/frontend/API_INVENTORY.md` |
| 4 Diseño | `docs/tfg/02-architecture-decisions.md`, `docs/frontend/STYLE_GUIDE.md` |
| 5 Implementación | `docs/tfg/05-parallel-workflow.md`, historial Git, `docs/coordination/*` |
| 6 Pruebas | `src/test/flows.test.jsx`, `scripts/audit/*`, `scripts/analyze/coverage.py` |
| 7 Generalización | `docs/tfg/agentic-generalization-notes.md` |
| Apéndice A | `docs/frontend/API_INVENTORY.md`, `scripts/analyze/coverage.py` (por fichero, sobre preview/integration) |
| Apéndice C | `docs/tfg/04-iterations.md` |
| Apéndice D | `AGENTS.md`, `CLAUDE.md`, `docs/coordination/*`, `.claude/`, historial Git (autoría y líneas de coautoría) |
| Apéndice E | `docs/frontend/STYLE_GUIDE.md`, `src/styles/tokens.css`, `src/ui/*`, `scripts/audit/style-audit.mjs` |

Listar lo pendiente: `grep -rn "pendiente" docs/memoria`.
