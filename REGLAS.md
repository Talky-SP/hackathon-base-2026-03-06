# FLAGS

- Agrupamos por proveedor y luego: Supplier + Fuzzy Matching > X && SupplierCIF diferente, se activa flag.
- Formatos de factura: Match de longitud y patrones letra/número. Si el patrón se rompa, se activa flag.
- Importes: Cálculo matemático de importa * Base Imponible = Total. Comprobar productos. Si no se cumple, flag.
- Fechas: Comprobar distribución y ver si hay algún outlier. Distancias entre fechas por ejemplo.

# SCORE

Basado en tamaño de la muestra del proveedor.
Basado en flags.
Basado en revisión humana.


