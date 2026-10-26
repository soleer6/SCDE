# H10 — visor del PDF en blanco bajo las zonas (RF-6.8)

`ZonesSection` descarga `GET /models/{id}/blank-pdf/` (contrato #14, solo con
`can_create_exams`) como object URL y pinta la página con react-pdf bajo los
rectángulos de zona. Si el PDF falla muestra un aviso y el editor numérico sigue
operativo.

Verificado con Edge headless + Vite (`VITE_MOCK_API=false`) + Django real en la
organización sintética de `fixtures-claude-authors`: GET 200 `application/pdf`,
página 1 renderizada (canvas con píxeles de contenido), zona QR existente y zona
`name` nueva superpuestas (`zones-real.mjs`, captura `h10-zones-real.png`).
Nota: la semilla de integración guarda un PDF falso de 16 bytes; se subió
`public/mock-pdfs/exam_101.pdf` al modelo sintético para la prueba (el visor
muestra el aviso de error con el stub, comprobado).

Pendiente: seleccionar/dibujar la zona arrastrando sobre el PDF.
