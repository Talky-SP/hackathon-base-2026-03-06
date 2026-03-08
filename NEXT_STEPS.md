Actualmente solo estan hechas las expense invoices. Añadir el resto de facturas.
Esta relativamente modular. Los fields de las expense invoices se encuentran todos en src/components/annotation/ExpenseAnnotationForm.tsx
Si le dices a claude que genere la pagina para los otros tipos de facturas pasandole la documentacion y el ExpenseAnnotationForm.tsx para que siga el formato, capaz que lo hará bien.

Subir el las entradas del golden dataset a la base de datos. Estabamos esperando a Dunkito.
Es decir hay que crear en el backend un endpoint que permita registrar las entradas dentro del golden dataset y enchufarlo al botón.
La idea es que si estás dentro de un file del batch este se asigne como completado o que desaparezca de la interfaz aunque siga dentro de la lista una vez lo mandes
y automaticamente se abra el siguiente del batch.

Hemos incluido algunas validaciones, sin embargo, la manera de mostrarlas no es la mejor, sería recomendable que fuera más vistoso pensamos en una tercera pestaña
en la izquierda que mostrase una lista de errores o con un acordeon según el tipo de error. Hay algunas reglas para las que sería combeniente crear recomendaciones en especial detectar dado el patrón del número de facturas si fallan los carácteres especiales o ya fijados dentro del patrón pues recomendar la versión con estos carácteres sustituidos o en las fechas si parece que los campos están desordenados hacer una heurística para que estén ordenados. Sería chulo que pudieras hacer tab y shift-tab para ir hacia adelante y detrás en el formulario o ctlr-tab para ir a los campos vacíos o erroneos. Hay código para que los desplegables se abran y cierren sin una vez te mueves a otro tab, este codigo estaba pensado para las regiones del OCR. Otra recomendación es hacer un mapa que se guarde en el endpoint que relacione las divisas con el símbolo para no tener que estar haciendo la relación manualmente. Una recomendación para el frontend es dejar más claro que campos son más importantes y cuales menos a lo mejor cambiando el color del borde de gris a naranja.

Las pestañas de experimentos(tests) y golden dataset dentro de la anotación estaban pensadas para buscar los ultimos experimentos y las ultimas entradas añadidas sin tener que cambiar de pestaña si consigues hacer la entrada en el endpoint estaría chulo poder mandar y volver rápidamente entre estas pestañas, aunque no es tan prioritario.

Pensamos en añadir tags customs a los elementos del golden dataset de esta manera dentro del test podrías seleccionar por tag custom además de por otras tags como el nivel de verificación el proveedor o la localización. No sé hasta que punto tiene Dunkito esto avanzado pero sería interesante integrarlo.

Integrar con lo que tenga Dunkito cuando haga push.


