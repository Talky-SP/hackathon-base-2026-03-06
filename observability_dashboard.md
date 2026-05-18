Ahora mismo en el panel de observabilidad puedes ver, para un OCR test run seleccionado:

1. **Selector de test runs completados**
   - Nombre del test.
   - Número de documentos.
   - Número de `tempLocations`.
   - Fecha de creación.

2. **Resumen del run**
   - Estado del run.
   - `tempLocations` asociadas.
   - Documentos observados.
   - Número total de eventos.
   - Número de llamadas detectadas.
   - Coste total agregado.
   - Tiempo acumulado de llamadas.
   - Rango temporal usado para consultar observabilidad.

3. **Lista de `tempLocations`**
   - CIF/source del test.
   - `tempLocationId`, por ejemplo:
     `ocr-test-2750c031-B87654321`

4. **Pasos del pipeline**
   - Stages detectados desde `/dag` y eventos:
     - legacy: normalmente `invoices_ocr`
     - V2: `starter`, `core`, `products`, `accounting`, `finalize`
   - Eventos por stage.
   - Calls por stage.
   - Coste por stage.
   - Errores por stage.

5. **Llamadas del paso seleccionado**
   - ID del evento.
   - Tipo: `ai_call`, `textract_call`, `lambda_invocation`, etc.
   - Modelo/proveedor/operación.
   - Tokens.
   - Coste.
   - Latencia.

6. **Documentos del test run**
   - Cargados desde:
     `GET /ocr-testing/test-runs/{testRunId}?includeDocs=true`
   - Para cada documento:
     - `ocrDocId`
     - `tempLocationId`
     - `verdict`
     - origen/SK/category

7. **Detalle del documento seleccionado**
   - Cargado desde:
     `GET /locations/{tempLocationId}/engineering/pipeline/documents/{ocrDocId}`
   - Timeline de eventos.
   - Llamadas IA/Textract/Lambda.
   - Coste por evento.
   - Coste agregado del documento.
   - Errores del documento si existen.

8. **Errores recientes**
   - Agrupados desde `/errors`.
   - Stage/errorClass/message si vienen en la respuesta.

La parte importante: ahora el panel ya no depende solo de `tempLocations`. También baja el detalle del run con `includeDocs=true`, y eso permite abrir observabilidad por documento usando `tempLocationId + ocrDocId`.