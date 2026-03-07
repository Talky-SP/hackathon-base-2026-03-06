export type Language = 'es' | 'en';

export const translations = {
  // Header
  'header.signOut': { es: 'Cerrar sesion', en: 'Sign out' },
  'header.evals': { es: 'Evals', en: 'Evals' },

  // Sidebar
  'nav.welcome': { es: 'Inicio', en: 'Home' },
  'nav.annotation': { es: 'Anotacion', en: 'Annotation' },
  'nav.goldenDataset': { es: 'Golden Dataset', en: 'Golden Dataset' },
  'nav.test': { es: 'Test', en: 'Test' },
  'nav.analytics': { es: 'Analiticas', en: 'Analytics' },
  'nav.docs': { es: 'Documentacion', en: 'Documentation' },
  'nav.resources': { es: 'Recursos', en: 'Resources' },
  'nav.objectives': { es: 'Objetivos', en: 'Objectives' },
  'nav.gettingStarted': { es: 'Primeros Pasos', en: 'Getting Started' },

  // Welcome page
  'welcome.title': { es: 'Bienvenido al Talky Hackathon', en: 'Welcome to the Talky Hackathon' },
  'welcome.subtitle': {
    es: 'Plataforma de evaluacion de modelos de IA con golden datasets',
    en: 'AI model evaluation platform with golden datasets',
  },
  'welcome.card.annotation.title': { es: 'Anotacion Humana', en: 'Human Annotation' },
  'welcome.card.annotation.desc': {
    es: 'Revisa y anota datos extraidos por IA de documentos reales.',
    en: 'Review and annotate AI-extracted data from real documents.',
  },
  'welcome.card.golden.title': { es: 'Golden Dataset', en: 'Golden Dataset' },
  'welcome.card.golden.desc': {
    es: 'Gestiona datasets curados de extracciones verificadas por humanos.',
    en: 'Manage curated datasets of human-verified extractions.',
  },
  'welcome.card.test.title': { es: 'Test & Evaluacion', en: 'Test & Evaluation' },
  'welcome.card.test.desc': {
    es: 'Ejecuta evaluaciones contra golden datasets y compara modelos.',
    en: 'Run evaluations against golden datasets and compare models.',
  },
  'welcome.card.analytics.title': { es: 'Analiticas', en: 'Analytics' },
  'welcome.card.analytics.desc': {
    es: 'Visualiza resultados y rastrea mejoras de los modelos de IA.',
    en: 'Visualize results and track AI model improvements over time.',
  },
  'welcome.card.docs.title': { es: 'Documentacion', en: 'Documentation' },
  'welcome.card.docs.desc': {
    es: 'Consulta la referencia completa de campos, APIs y flujos de datos.',
    en: 'Check the complete reference for fields, APIs and data flows.',
  },
  'welcome.card.resources.title': { es: 'Recursos', en: 'Resources' },
  'welcome.card.resources.desc': {
    es: 'Herramientas de diseno, arquitectura AWS y recursos utiles.',
    en: 'Design tools, AWS architecture and useful resources.',
  },
  'welcome.quickStart': { es: 'Inicio Rapido', en: 'Quick Start' },
  'welcome.quickStart.desc': {
    es: 'Empieza anotando documentos, construye golden datasets, ejecuta tests y analiza resultados.',
    en: 'Start annotating documents, build golden datasets, run tests and analyze results.',
  },
  'welcome.hackathon.badge': { es: 'Hackathon 2026', en: 'Hackathon 2026' },
  'welcome.hackathon.desc': {
    es: 'Construye la mejor plataforma de evaluacion de IA para el procesamiento de documentos financieros.',
    en: 'Build the best AI evaluation platform for financial document processing.',
  },

  // Annotation page
  'annotation.title': { es: 'Anotacion Humana', en: 'Human Annotation' },
  'annotation.subtitle': {
    es: 'Revisa y anota datos extraidos por IA de documentos.',
    en: 'Review and annotate AI-extracted data from documents.',
  },
  'annotation.comingSoon': { es: 'Proximamente', en: 'Coming soon' },
  'annotation.comingSoonDesc': {
    es: 'La interfaz de anotacion te permitira revisar, corregir y validar campos extraidos por IA de facturas, albaranes y nominas.',
    en: 'The annotation interface will allow you to review, correct, and validate AI-extracted fields from invoices, delivery notes, and payrolls.',
  },

  // Annotation upload zone
  'annotation.upload.title': { es: 'Sube PDFs o imagenes para comenzar el proceso de anotacion', en: 'Upload PDFs or images to start the annotation process' },
  'annotation.upload.goldenDesc': {
    es: 'Sube PDFs o imagenes para comenzar el proceso de anotacion y construir tu golden dataset',
    en: 'Upload PDFs or images to start the annotation process and build your golden dataset',
  },
  'annotation.upload.dragDrop': { es: 'Arrastra y suelta archivos aqui', en: 'Drag & drop files here' },
  'annotation.upload.dropHere': { es: 'Suelta los archivos aqui', en: 'Drop files here' },
  'annotation.upload.processing': { es: 'Procesando archivos...', en: 'Processing files...' },
  'annotation.upload.browseFiles': { es: 'o haz clic para buscar archivos', en: 'or click to browse your files' },
  'annotation.upload.validating': { es: 'Validando tipos de archivo', en: 'Validating file types' },
  'annotation.upload.acceptedFormats': { es: 'Formatos aceptados: PDF, PNG, JPG, JPEG, WEBP', en: 'Accepted formats: PDF, PNG, JPG, JPEG, WEBP' },
  'annotation.upload.filesUploaded': { es: 'archivo(s) subido(s)', en: 'file(s) uploaded' },
  'annotation.upload.clearAll': { es: 'Limpiar todo', en: 'Clear All' },
  'annotation.upload.addMore': { es: 'Anadir mas archivos', en: 'Add more files' },
  'annotation.upload.invalidFiles': {
    es: 'Tipo(s) de archivo no valido(s). Solo se permiten archivos PDF e imagenes (PNG, JPG, JPEG, WEBP).',
    en: 'Invalid file type(s). Only PDF and image files (PNG, JPG, JPEG, WEBP) are allowed.',
  },
  'annotation.upload.maxFiles': { es: 'Maximo de archivos permitidos', en: 'Maximum files allowed' },
  'annotation.upload.errorProcessing': { es: 'Error procesando archivos', en: 'Error processing files' },

  // Golden Dataset page
  'golden.title': { es: 'Golden Dataset', en: 'Golden Dataset' },
  'golden.subtitle': {
    es: 'Gestiona datasets curados de extracciones de documentos verificadas por humanos.',
    en: 'Manage curated datasets of human-verified document extractions.',
  },
  'golden.comingSoon': { es: 'Proximamente', en: 'Coming soon' },
  'golden.comingSoonDesc': {
    es: 'Explora y gestiona golden datasets construidos a partir de anotaciones humanas. Rastrea la completitud y metricas de calidad del dataset.',
    en: 'Browse and manage golden datasets built from human annotations. Track dataset completeness and quality metrics.',
  },

  // Test page
  'test.title': { es: 'Test', en: 'Test' },
  'test.subtitle': {
    es: 'Ejecuta evaluaciones contra golden datasets y compara el rendimiento de modelos de IA.',
    en: 'Run evaluations against golden datasets and compare AI model performance.',
  },
  'test.comingSoon': { es: 'Proximamente', en: 'Coming soon' },
  'test.comingSoonDesc': {
    es: 'Ejecuta evaluaciones comparando extracciones de IA contra golden datasets. Visualiza metricas de precision y rendimiento por campo.',
    en: 'Execute evaluation runs comparing AI extractions against golden datasets. View accuracy metrics and field-level performance.',
  },

  // Analytics page
  'analytics.title': { es: 'Analiticas', en: 'Analytics' },
  'analytics.subtitle': {
    es: 'Visualiza resultados de evaluaciones y rastrea mejoras de modelos de IA a lo largo del tiempo.',
    en: 'Visualize evaluation results and track AI model improvements over time.',
  },
  'analytics.comingSoon': { es: 'Proximamente', en: 'Coming soon' },
  'analytics.comingSoonDesc': {
    es: 'Dashboards con tendencias de precision, distribuciones de confianza, analisis de errores por campo y graficos de comparacion de modelos.',
    en: 'Dashboards with accuracy trends, confidence distributions, field-level error analysis, and model comparison charts.',
  },

  // Resources page
  'resources.title': { es: 'Recursos', en: 'Resources' },
  'resources.subtitle': {
    es: 'Herramientas, referencias y recursos utiles para el desarrollo del hackathon.',
    en: 'Tools, references and useful resources for hackathon development.',
  },
  'resources.design': { es: 'Diseno & UI', en: 'Design & UI' },
  'resources.designDesc': {
    es: 'Herramientas e inspiracion para el diseno de interfaces.',
    en: 'Tools and inspiration for interface design.',
  },
  'resources.architecture': { es: 'Arquitectura & Cloud', en: 'Architecture & Cloud' },
  'resources.architectureDesc': {
    es: 'Recursos de arquitectura y mejores practicas de AWS.',
    en: 'Architecture resources and AWS best practices.',
  },
  'resources.visitSite': { es: 'Visitar sitio', en: 'Visit site' },
  'resources.downloadPdf': { es: 'Descargar PDF', en: 'Download PDF' },

  // Auth form
  'auth.signIn': { es: 'Iniciar sesion', en: 'Sign in' },
  'auth.signUp': { es: 'Crear cuenta', en: 'Create account' },
  'auth.confirmSignUp': { es: 'Verificar cuenta', en: 'Verify account' },
  'auth.forgotPassword': { es: 'Recuperar contrasena', en: 'Recover password' },
  'auth.newPassword': { es: 'Nueva contrasena', en: 'New password' },
  'auth.mfa': { es: 'Verificacion MFA', en: 'MFA Verification' },
  'auth.signIn.subtitle': { es: 'Accede con tu cuenta @talky-lab.com', en: 'Sign in with your @talky-lab.com account' },
  'auth.signUp.subtitle': { es: 'Crea tu cuenta para acceder a la plataforma', en: 'Create your account to access the platform' },
  'auth.confirmSignUp.subtitle': { es: 'Introduce el codigo enviado a tu email', en: 'Enter the code sent to your email' },
  'auth.forgotPassword.subtitle': { es: 'Te enviaremos un codigo de recuperacion', en: 'We will send you a recovery code' },
  'auth.newPassword.subtitle': { es: 'Introduce el codigo y tu nueva contrasena', en: 'Enter the code and your new password' },
  'auth.mfa.subtitle': { es: 'Introduce el codigo de tu app autenticadora', en: 'Enter the code from your authenticator app' },
  'auth.enter': { es: 'Entrar', en: 'Sign in' },
  'auth.createAccount': { es: 'Crear cuenta', en: 'Create account' },
  'auth.verify': { es: 'Verificar', en: 'Verify' },
  'auth.sendCode': { es: 'Enviar codigo', en: 'Send code' },
  'auth.changePassword': { es: 'Cambiar contrasena', en: 'Change password' },
  'auth.back': { es: 'Volver', en: 'Go back' },
  'auth.or': { es: 'o', en: 'or' },
  'auth.googleContinue': { es: 'Continuar con Google', en: 'Continue with Google' },
  'auth.forgotPasswordLink': { es: 'He olvidado mi contrasena', en: 'I forgot my password' },
  'auth.noAccount': { es: 'No tienes cuenta?', en: "Don't have an account?" },
  'auth.hasAccount': { es: 'Ya tienes cuenta?', en: 'Already have an account?' },
  'auth.resendCode': { es: 'Reenviar codigo', en: 'Resend code' },
  'auth.emailPlaceholder': { es: 'tu@talky-lab.com', en: 'you@talky-lab.com' },
  'auth.passwordPlaceholder': { es: 'Contrasena', en: 'Password' },
  'auth.confirmPasswordPlaceholder': { es: 'Confirmar contrasena', en: 'Confirm password' },
  'auth.platform': { es: 'Evals Platform', en: 'Evals Platform' },
  'auth.internalTools': { es: 'Internal Tools', en: 'Internal Tools' },

  // Auth errors
  'auth.error.notConfirmed': { es: 'Tu cuenta no esta verificada. Introduce el codigo enviado a tu email.', en: 'Your account is not verified. Enter the code sent to your email.' },
  'auth.error.usernameExists': { es: 'Ya existe una cuenta con este email.', en: 'An account with this email already exists.' },
  'auth.error.codeMismatch': { es: 'Codigo incorrecto. Intentalo de nuevo.', en: 'Incorrect code. Try again.' },
  'auth.error.expiredCode': { es: 'El codigo ha expirado. Solicita uno nuevo.', en: 'The code has expired. Request a new one.' },
  'auth.error.notAuthorized': { es: 'Credenciales incorrectas.', en: 'Incorrect credentials.' },
  'auth.error.userNotFound': { es: 'No existe una cuenta con este email.', en: 'No account exists with this email.' },
  'auth.error.limitExceeded': { es: 'Demasiados intentos. Espera un momento.', en: 'Too many attempts. Wait a moment.' },
  'auth.error.invalidPassword': { es: 'La contrasena no cumple los requisitos minimos.', en: 'The password does not meet minimum requirements.' },
  'auth.error.invalidParam': { es: 'Datos invalidos. Revisa los campos.', en: 'Invalid data. Check the fields.' },
  'auth.error.generic': { es: 'Ha ocurrido un error. Intentalo de nuevo.', en: 'An error occurred. Try again.' },
  'auth.error.passwordMismatch': { es: 'Las contrasenas no coinciden.', en: 'Passwords do not match.' },
  'auth.msg.codeSent': { es: 'Hemos enviado un codigo de verificacion a tu email.', en: 'We have sent a verification code to your email.' },
  'auth.msg.verified': { es: 'Cuenta verificada. Ya puedes iniciar sesion.', en: 'Account verified. You can now sign in.' },
  'auth.msg.codeResent': { es: 'Codigo reenviado a tu email.', en: 'Code resent to your email.' },
  'auth.msg.recoverySent': { es: 'Hemos enviado un codigo de recuperacion a tu email.', en: 'We have sent a recovery code to your email.' },
  'auth.msg.passwordUpdated': { es: 'Contrasena actualizada. Ya puedes iniciar sesion.', en: 'Password updated. You can now sign in.' },

  // Workspace
  'workspace.back': { es: 'Volver', en: 'Back' },
  'workspace.addFiles': { es: 'Anadir archivos', en: 'Add files' },
  'workspace.files': { es: 'Archivos', en: 'Files' },
  'workspace.noFileSelected': { es: 'Selecciona un archivo para visualizarlo', en: 'Select a file to view it' },

  // Viewer toolbar
  'viewer.zoomIn': { es: 'Acercar', en: 'Zoom in' },
  'viewer.zoomOut': { es: 'Alejar', en: 'Zoom out' },
  'viewer.fitWidth': { es: 'Ajustar al ancho', en: 'Fit width' },
  'viewer.rotate': { es: 'Rotar', en: 'Rotate' },
  'viewer.page': { es: 'Pagina', en: 'Page' },
  'viewer.of': { es: 'de', en: 'of' },
  'viewer.loading': { es: 'Cargando documento...', en: 'Loading document...' },
  'viewer.error': { es: 'Error al cargar el documento', en: 'Error loading document' },

  // Annotation panel
  'annotation.panel.title': { es: 'Anotacion', en: 'Annotation' },
  'annotation.panel.docInfo': { es: 'Informacion del documento', en: 'Document Info' },
  'annotation.panel.filename': { es: 'Nombre del archivo', en: 'Filename' },
  'annotation.panel.type': { es: 'Tipo', en: 'Type' },
  'annotation.panel.status': { es: 'Estado', en: 'Status' },
  'annotation.panel.pending': { es: 'Pendiente', en: 'Pending' },
  'annotation.panel.sendOcr': { es: 'Enviar a OCR', en: 'Send to OCR' },
  'annotation.panel.supplier': { es: 'Proveedor', en: 'Supplier' },
  'annotation.panel.supplierName': { es: 'Nombre del proveedor', en: 'Supplier name' },
  'annotation.panel.supplierVat': { es: 'CIF / NIF', en: 'VAT number' },
  'annotation.panel.amounts': { es: 'Importes', en: 'Amounts' },
  'annotation.panel.totalAmount': { es: 'Importe total', en: 'Total amount' },
  'annotation.panel.taxAmount': { es: 'Importe de impuestos', en: 'Tax amount' },
  'annotation.panel.invoiceNumber': { es: 'Numero de factura', en: 'Invoice number' },
  'annotation.panel.invoiceDate': { es: 'Fecha de factura', en: 'Invoice date' },
  'annotation.panel.confidence': { es: 'Confianza', en: 'Confidence' },
  'annotation.panel.markReviewed': { es: 'Marcar como revisado', en: 'Mark as Reviewed' },
  'annotation.panel.saveGolden': { es: 'Guardar en Golden Dataset', en: 'Save to Golden Dataset' },
  'annotation.panel.skip': { es: 'Omitir', en: 'Skip' },

  // Docs page sections (headers only - content stays as-is since it's technical reference)
  'docs.title': { es: 'Documentacion', en: 'Documentation' },
  'docs.subtitle': { es: 'Referencia completa de campos, APIs y flujos de datos', en: 'Complete reference for fields, APIs and data flows' },

  // Tabs
  'tabs.close': { es: 'Cerrar pestana', en: 'Close tab' },
  'tabs.noOpenTabs': { es: 'No hay pestanas abiertas', en: 'No open tabs' },

  // Sidebar tabs
  'sidebar.files': { es: 'Archivos', en: 'Files' },
  'sidebar.imports': { es: 'Importar', en: 'Import' },

  // Imports panel
  'imports.experiments': { es: 'Experimentos', en: 'Experiments' },
  'imports.goldenDataset': { es: 'Golden Dataset', en: 'Golden Dataset' },
  'imports.unreviewed': { es: 'Sin Revisar', en: 'Unreviewed' },
  'imports.comingSoon': { es: 'Próximamente', en: 'Coming soon' },
  'imports.dropFiles': { es: 'Arrastra o haz clic para añadir archivos', en: 'Drop or click to add files' },
  'imports.searchLocation': { es: 'Buscar ubicación...', en: 'Search location...' },
  'imports.noResults': { es: 'Sin resultados', en: 'No results' },
  'imports.loadingLocations': { es: 'Cargando ubicaciones...', en: 'Loading locations...' },
  'imports.loadingDocs': { es: 'Cargando documentos...', en: 'Loading documents...' },
  'imports.noDocs': { es: 'No se encontraron documentos', en: 'No documents found' },
  'imports.searchProvider': { es: 'Buscar proveedor...', en: 'Search provider...' },
  'imports.allProviders': { es: 'Todos los proveedores', en: 'All providers' },
  'imports.loadingProviders': { es: 'Cargando proveedores...', en: 'Loading providers...' },
  'imports.noProviders': { es: 'No se encontraron proveedores', en: 'No providers found' },
  'imports.selectedFiles': { es: 'Archivos seleccionados', en: 'Selected files' },
  'imports.selectFilter': { es: 'Selecciona una ubicación o proveedor para ver documentos', en: 'Select a location or provider to view documents' },
  'imports.location': { es: 'Ubicación', en: 'Location' },
  'imports.provider': { es: 'Proveedor', en: 'Provider' },
  'imports.loadMore': { es: 'Cargar más', en: 'Load more' },
  'imports.endOfList': { es: '— Fin de la lista —', en: '— End of list —' },
  'imports.loadingMore': { es: 'Cargando más...', en: 'Loading more...' },
  'imports.searchMode.supplier': { es: 'Proveedor', en: 'Supplier' },
  'imports.searchMode.invoiceNumber': { es: 'Nº Factura', en: 'Invoice Number' },
  'imports.searchInvoice': { es: 'Buscar por número...', en: 'Search by number...' },
  'imports.bulkSelect': { es: 'Selección masiva', en: 'Bulk Selection' },
  'imports.bulkNoMore': { es: 'No quedan documentos sin seleccionar', en: 'No unselected documents remaining' },
  'imports.bulkModalTitle': { es: 'Selección masiva', en: 'Bulk Selection' },
  'imports.bulkCount': { es: 'Número de documentos', en: 'Number of documents' },
  'imports.bulkStart': { es: 'Seleccionar', en: 'Select' },
  'imports.bulkProgress': { es: 'Importando {0}/{1}...', en: 'Importing {0}/{1}...' },
  'imports.bulkDone': { es: '{0} archivos importados de {1} disponibles', en: '{0} files imported of {1} available' },
  'imports.bulkBatchName': { es: 'Nombre del lote', en: 'Batch name' },
  'imports.bulkCreateBatch': { es: 'Crear lote', en: 'Create batch' },
  'imports.bulkCancel': { es: 'Cancelar', en: 'Cancel' },
  'imports.bulkClose': { es: 'Cerrar', en: 'Close' },

  // Batches
  'batches.imported': { es: 'Importados', en: 'Imported' },
  'batches.new': { es: 'Nuevo lote', en: 'New batch' },
  'batches.rename': { es: 'Renombrar lote', en: 'Rename batch' },
  'batches.delete': { es: 'Eliminar lote', en: 'Delete batch' },
  'batches.defaultName': { es: 'Nuevo lote', en: 'New batch' },

  // Batch buffer & naming modal
  'batches.selectedFiles': { es: 'Archivos seleccionados', en: 'Selected files' },
  'batches.createBatch': { es: 'Crear lote', en: 'Create batch' },
  'batches.nameModalTitle': { es: 'Nombre del lote', en: 'Batch name' },
  'batches.nameModalPlaceholder': { es: 'Introduce un nombre...', en: 'Enter a name...' },
  'batches.confirm': { es: 'Crear', en: 'Create' },
  'batches.cancel': { es: 'Cancelar', en: 'Cancel' },

  // File type modal
  'fileType.modalTitle': { es: 'Tipo de documento', en: 'Document type' },
  'fileType.confirm': { es: 'Confirmar', en: 'Confirm' },
  'fileType.cancel': { es: 'Cancelar', en: 'Cancel' },

  // ─── Annotation form: section headers ────────────────────────────────────
  'annotation.form.invoiceHeader': { es: 'Cabecera de factura', en: 'Invoice Header' },
  'annotation.form.supplierProvince': { es: 'Provincia del proveedor', en: 'Supplier Province' },
  'annotation.form.supplierAddress': { es: 'Direccion del proveedor', en: 'Supplier Address' },
  'annotation.form.dueDate': { es: 'Fecha de vencimiento', en: 'Due Date' },
  'annotation.form.period': { es: 'Periodo', en: 'Period' },
  'annotation.form.concept': { es: 'Concepto', en: 'Concept' },
  'annotation.form.category': { es: 'Categoria', en: 'Category' },
  'annotation.form.currency': { es: 'Moneda', en: 'Currency' },
  'annotation.form.currencyCode': { es: 'Codigo', en: 'Code' },
  'annotation.form.currencySymbol': { es: 'Simbolo', en: 'Symbol' },
  'annotation.form.ibans': { es: 'IBANs', en: 'IBANs' },
  'annotation.form.iban': { es: 'IBAN', en: 'IBAN' },
  'annotation.form.owner': { es: 'Titular', en: 'Owner' },
  'annotation.form.role': { es: 'Rol', en: 'Role' },
  'annotation.form.subtotal': { es: 'Subtotal (importe)', en: 'Subtotal (importe)' },
  'annotation.form.withholding': { es: 'Retencion', en: 'Withholding (retencion)' },
  'annotation.form.withholdingType': { es: 'Tipo de retencion', en: 'Withholding Type' },
  'annotation.form.vatLines': { es: 'Lineas de IVA', en: 'VAT Lines' },
  'annotation.form.iva': { es: 'IVA', en: 'IVA' },
  'annotation.form.base': { es: 'Base', en: 'Base' },
  'annotation.form.ratePercent': { es: 'Tipo %', en: 'Rate %' },
  'annotation.form.amount': { es: 'Importe', en: 'Amount' },
  'annotation.form.generalDiscounts': { es: 'Descuentos generales', en: 'General Discounts' },
  'annotation.form.discount': { es: 'Descuento', en: 'Discount' },
  'annotation.form.name': { es: 'Nombre', en: 'Name' },
  'annotation.form.products': { es: 'Productos / Lineas', en: 'Products / Line Items' },
  'annotation.form.product': { es: 'Producto', en: 'Product' },
  'annotation.form.qty': { es: 'Cant.', en: 'Qty' },
  'annotation.form.unitPrice': { es: 'Precio ud.', en: 'Unit €' },
  'annotation.form.total': { es: 'Total', en: 'Total' },
  'annotation.form.disc': { es: 'Dto.', en: 'Disc.' },
  'annotation.form.productId': { es: 'ID producto', en: 'Product ID' },
  'annotation.form.packAi': { es: 'PackAI', en: 'PackAI' },
  'annotation.form.type': { es: 'Tipo', en: 'Type' },
  'annotation.form.usable': { es: 'Usable', en: 'Usable' },
  'annotation.form.conf': { es: 'Conf.', en: 'Conf' },
  'annotation.form.lineTotal': { es: 'Total linea', en: 'Line total' },
  'annotation.form.unitQty': { es: 'Cant. ud.', en: 'Unit qty' },
  'annotation.form.unitPriceLabel': { es: 'Precio ud.', en: 'Unit €' },
  'annotation.form.packs': { es: 'Packs', en: 'Packs' },
  'annotation.form.packUnit': { es: 'Ud. pack', en: 'Pack unit' },
  'annotation.form.perPack': { es: 'Por pack', en: 'Per pack' },
  'annotation.form.yes': { es: 'Si', en: 'Yes' },
  'annotation.form.no': { es: 'No', en: 'No' },
  'annotation.form.docClassification': { es: 'Clasificacion de documento', en: 'Document Classification' },
  'annotation.form.documentKind': { es: 'Tipo de documento', en: 'Document Kind' },
  'annotation.form.kindConfidence': { es: 'Confianza del tipo', en: 'Kind Confidence' },
  'annotation.form.multiInvoice': { es: 'Multi-factura detectada', en: 'Multi-Invoice Detected' },
  'annotation.form.multiInvoiceLabel': { es: 'Multi-factura', en: 'Multi-invoice' },
  'annotation.form.reviewFlags': { es: 'Revision y motivos', en: 'Review Flags & Reasons' },
  'annotation.form.needsReview': { es: 'Necesita revision', en: 'Needs Review' },
  'annotation.form.talkyVerified': { es: 'Verificado por Talky', en: 'Talky Verified' },
  'annotation.form.reviewReason': { es: 'Motivo de revision', en: 'Review Reason' },
  'annotation.form.allReviewReasons': { es: 'Todos los motivos', en: 'All Review Reasons' },
  'annotation.form.none': { es: '(ninguno)', en: '(none)' },

  // ─── Annotation form: summary strings ────────────────────────────────────
  'annotation.form.vatSummaryLines': { es: 'lineas', en: 'lines' },
  'annotation.form.vatSummaryLine': { es: 'linea', en: 'line' },
  'annotation.form.totalVat': { es: 'Total IVA', en: 'Total VAT' },
  'annotation.form.discountSummary': { es: 'descuentos', en: 'discounts' },
  'annotation.form.discountSummarySingular': { es: 'descuento', en: 'discount' },
  'annotation.form.itemSummary': { es: 'articulos', en: 'items' },
  'annotation.form.itemSummarySingular': { es: 'articulo', en: 'item' },
  'annotation.form.verified': { es: 'Verificado', en: 'Verified' },
  'annotation.form.ok': { es: 'OK', en: 'OK' },
  'annotation.form.needsReviewSummary': { es: 'Necesita revision', en: 'Needs review' },

  // ─── Annotation status messages ──────────────────────────────────────────
  'annotation.status.loadingOcr': { es: 'Cargando OCR...', en: 'Loading OCR...' },
  'annotation.status.ocrReady': { es: 'OCR listo', en: 'OCR Ready' },
  'annotation.status.error': { es: 'Error', en: 'Error' },

  // ─── Annotation action labels ────────────────────────────────────────────
  'annotation.action.downloadInvoice': { es: 'Factura JSON', en: 'Invoice JSON' },
  'annotation.action.downloadOcr': { es: 'OCR JSON', en: 'OCR JSON' },
  'annotation.action.removeFile': { es: 'Eliminar archivo', en: 'Remove file' },

  // ─── Annotation tag UI ───────────────────────────────────────────────────
  'annotation.tag.add': { es: 'Anadir anotacion', en: 'Add annotation' },
  'annotation.tag.searchOrCreate': { es: 'Buscar o crear...', en: 'Search or create...' },
  'annotation.tag.create': { es: 'Crear', en: 'Create' },
  'annotation.tag.noAnnotations': { es: 'Sin anotaciones', en: 'No annotations' },

  // ─── Viewer bbox mode labels ─────────────────────────────────────────────
  'viewer.bbox.precise': { es: 'Preciso', en: 'Precise' },
  'viewer.bbox.metadata': { es: 'Metadatos', en: 'Metadata' },
  'viewer.bbox.off': { es: 'Apagado', en: 'Off' },

  // ─── Default batch name ──────────────────────────────────────────────────
  'batches.importedDefault': { es: 'Importados', en: 'Imported' },

  // ─── Notifications ────────────────────────────────────────────────────────
  'batches.batchCreated': { es: 'Lote creado', en: 'Batch created' },

  'notification.testSuccess': { es: 'Operacion completada con exito', en: 'Operation completed successfully' },
  'notification.testError': { es: 'Ha ocurrido un error inesperado', en: 'An unexpected error occurred' },
  'notification.testInfo': { es: 'Informacion: proceso en curso', en: 'Info: process in progress' },
  'notification.testWarning': { es: 'Advertencia: revisa la configuracion', en: 'Warning: check your configuration' },
  'notification.testButton': { es: 'Probar notificaciones', en: 'Test notifications' },
} as const;

export type TranslationKey = keyof typeof translations;
