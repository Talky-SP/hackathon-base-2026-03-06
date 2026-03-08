# FLAGS

- Agrupamos por proveedor y luego: Supplier + Fuzzy Matching > X && SupplierCIF diferente, se activa flag.
- Formatos de factura: Match de longitud y patrones letra/número. Si el patrón se rompa, se activa flag.
- Importes: Cálculo matemático de importa * Base Imponible = Total. Comprobar productos. Si no se cumple, flag.
- Fechas: Comprobar distribución y ver si hay algún outlier. Distancias entre fechas por ejemplo.

# SCORE

Basado en tamaño de la muestra del proveedor.
Basado en flags.
Basado en revisión humana.

Fechas:
    Alguna en el futuro. FLAG
    Alguna antes del 2017. FLAG
    Formato inválido. FLAG y sugerir formato
    Diferencia de fechas IQR * 3. FLAG
    Rangos de fechas. IQR * 1.5. FLAG
    Rangos de fechas, invertidos. FLAG



