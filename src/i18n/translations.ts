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
  'viewer.fitPage': { es: 'Ajustar a la pagina', en: 'Fit page' },
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
} as const;

export type TranslationKey = keyof typeof translations;
