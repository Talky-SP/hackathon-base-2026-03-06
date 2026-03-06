import {
  Target, Layers, FlaskConical, BarChart3, Cpu, Package, FileCheck, Landmark,
  CheckCircle, AlertTriangle, Zap, Users, Coffee, MessageSquare, Code2,
  ArrowRight, Boxes, Scale, Search, TrendingUp, Filter, GitBranch,
  Timer, DollarSign, Bell, MapPin,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

function SectionHeader({ icon: Icon, title, color }: { icon: typeof Target; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function PhaseCard({ number, icon: Icon, title, color, children }: {
  number: string;
  icon: typeof Target;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-3 ${color}`}>
        <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center">
          <Icon size={18} />
        </div>
        <div>
          <span className="text-xs font-mono font-bold opacity-70">{number}</span>
          <h3 className="text-base font-bold">{title}</h3>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

function BulletPoint({ icon: Icon, title, children }: { icon: typeof CheckCircle; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">
        <Icon size={16} className="text-brand-500" />
      </div>
      <div>
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function PipelineStep({ number, icon: Icon, title, description, color }: {
  number: string;
  icon: typeof Cpu;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono font-bold text-gray-400">{number}</span>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ArsenalItem({ icon: Icon, title, description }: { icon: typeof Code2; title: string; description: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-gray-500" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function ObjectivesPage() {
  const { language } = useLanguage();
  const es = language === 'es';

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-12">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 sm:p-10 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/10 rounded-full -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-brand-500/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono bg-brand-500/20 text-brand-300 px-2.5 py-1 rounded-md border border-brand-500/30">
              Hackathon 2026
            </span>
            <span className="text-xs font-mono bg-white/10 text-gray-300 px-2.5 py-1 rounded-md">
              AI Evals Platform
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            {es ? 'Testeando en la era de los sistemas no deterministas' : 'Testing in the era of non-deterministic systems'}
          </h1>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mt-5">
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed italic">
              {es
                ? '"En el software tradicional, 1 + 1 siempre es 2. En la era de la Inteligencia Artificial, 1 + 1 es \'aproximadamente 2, pero a veces es 2.01 y te lo explico en un parrafo\'. Como aseguramos la calidad cuando el sistema base cambia de opinion?"'
                : '"In traditional software, 1 + 1 is always 2. In the era of Artificial Intelligence, 1 + 1 is \'approximately 2, but sometimes it\'s 2.01 and I\'ll explain it in a paragraph\'. How do we ensure quality when the base system changes its mind?"'}
            </p>
          </div>
        </div>
      </div>

      {/* Context */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-6">
        <p className="text-sm text-brand-900 leading-relaxed">
          {es
            ? 'Bienvenidos al reto. Hemos construido un pipeline impulsado por IA que automatiza el back-office financiero y logistico: extrae datos, normaliza productos, concilia documentos y cuadra bancos. Funciona de manera excepcional, pero necesitamos instrumentacion avanzada. Si manana cambiamos un prompt, actualizamos un modelo o modificamos una logica, necesitamos saber exactamente el impacto de ese cambio.'
            : 'Welcome to the challenge. We have built an AI-powered pipeline that automates the financial and logistics back-office: extracts data, normalizes products, reconciles documents and matches bank statements. It works exceptionally well, but we need advanced instrumentation. If tomorrow we change a prompt, update a model, or modify a logic, we need to know exactly the impact of that change.'}
        </p>
        <p className="text-sm text-brand-800 leading-relaxed mt-3">
          {es
            ? 'Ademas, el trabajo que realiceis durante este hackathon tiene un proposito mas alla del uso interno: este panel se usara como herramienta central para el desarrollo de un paper de investigacion en el que estamos trabajando sobre la automatizacion de la ingenieria de prompts.'
            : 'Furthermore, the work you do during this hackathon has a purpose beyond internal use: this panel will be used as a central tool for developing a research paper we are working on about the automation of prompt engineering.'}
        </p>
        <div className="mt-4 pt-4 border-t border-brand-200">
          <p className="text-sm font-semibold text-brand-900">
            {es
              ? 'Vuestra mision este fin de semana es construir una plataforma integral de evaluacion continua, dividida en tres grandes bloques funcionales.'
              : 'Your mission this weekend is to build a comprehensive continuous evaluation platform, divided into three major functional blocks.'}
          </p>
        </div>
      </div>

      {/* The Three Phases */}
      <div>
        <SectionHeader
          icon={Target}
          title={es ? 'El Objetivo en Tres Fases' : 'The Objective in Three Phases'}
          color="bg-brand-50 text-brand-600"
        />
        <p className="text-sm text-gray-500 mb-6">
          {es
            ? 'El proyecto debe estructurarse en las siguientes tres fases de desarrollo:'
            : 'The project must be structured in the following three development phases:'}
        </p>

        <div className="space-y-6">
          {/* Phase 1 */}
          <PhaseCard
            number={es ? 'FASE 1' : 'PHASE 1'}
            icon={Layers}
            title={es ? 'Plataforma de Human Annotations (Creacion del Golden)' : 'Human Annotations Platform (Golden Creation)'}
            color="bg-brand-50 text-brand-900"
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              {es
                ? 'Dado que partimos de datos sin etiquetar, lo primero es construir la herramienta para crear el Ground Truth.'
                : 'Since we start with unlabeled data, the first step is to build the tool to create the Ground Truth.'}
            </p>
            <BulletPoint icon={FileCheck} title={es ? 'Ingesta y Validacion' : 'Ingestion & Validation'}>
              {es
                ? 'Un panel donde podamos subir nuevos PDFs o datos crudos, pasarlos por el sistema, revisar el output generado y, si es correcto (o una vez corregido manualmente), anadirlo al Golden Dataset.'
                : 'A panel where we can upload new PDFs or raw data, pass them through the system, review the generated output and, if correct (or once manually corrected), add it to the Golden Dataset.'}
            </BulletPoint>
            <BulletPoint icon={AlertTriangle} title={es ? 'Anotacion de Errores' : 'Error Annotation'}>
              {es
                ? 'Capacidad para marcar casos que han fallado, documentar cual deberia ser la respuesta correcta y categorizar el tipo de error. Estos casos con fallos conocidos deben guardarse para verificar si futuras versiones del pipeline los resuelven.'
                : 'Ability to mark failed cases, document what the correct answer should be, and categorize the error type. These cases with known failures must be saved to verify if future pipeline versions resolve them.'}
            </BulletPoint>
            <BulletPoint icon={Timer} title={es ? 'Velocidad de Anotacion' : 'Annotation Speed'}>
              {es
                ? 'Se evaluara la rapidez con la que se pueden hacer las anotaciones. Pensad en formas ingeniosas para acelerar el proceso: atajos de teclado, aceptar/rechazar con un clic, auto-completado inteligente, vistas comparativas lado a lado, o cualquier mecanismo que reduzca el tiempo por documento.'
                : 'The speed at which annotations can be made will be evaluated. Think of creative ways to accelerate the process: keyboard shortcuts, one-click accept/reject, smart auto-complete, side-by-side comparison views, or any mechanism that reduces time per document.'}
            </BulletPoint>
            <BulletPoint icon={Boxes} title={es ? 'Validacion de Productos' : 'Product Validation'}>
              {es
                ? 'Es critico detectar productos duplicados en la normalizacion (mismo producto con nombres ligeramente diferentes debe tener el mismo product_id). Verificar que cantidad x precio_unitario = importe_linea y que la suma de lineas coincida con el total de la factura.'
                : 'It is critical to detect duplicate products in normalization (same product with slightly different names must have the same product_id). Verify that quantity x unit_price = line_amount and that the sum of lines matches the invoice total.'}
            </BulletPoint>
          </PhaseCard>

          {/* Phase 2 */}
          <PhaseCard
            number={es ? 'FASE 2' : 'PHASE 2'}
            icon={FlaskConical}
            title={es ? 'Plataforma de Testing (Ejecucion Selectiva y Smart Evals)' : 'Testing Platform (Selective Execution & Smart Evals)'}
            color="bg-blue-50 text-blue-900"
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              {es
                ? 'El motor de evaluacion donde ocurre la magia de las pruebas. Es fundamental optimizar costes: primero tests rapidos y baratos para detectar errores evidentes, luego tests selectivos sobre subsets problematicos, y solo al final el dataset completo.'
                : 'The evaluation engine where the testing magic happens. Cost optimization is key: first quick and cheap tests to catch obvious errors, then selective tests on problematic subsets, and only at the end the full dataset.'}
            </p>
            <BulletPoint icon={DollarSign} title={es ? 'Eficiencia de Costes' : 'Cost Efficiency'}>
              {es
                ? 'Se evalua la eficiencia de costes del sistema de testing. La estrategia debe ser: primero ejecutar tests con casos sencillos y rapidos para detectar errores obvios sin gastar, luego poder seleccionar subsets dentro del Golden Dataset (por ejemplo, solo los que tienen errores conocidos) para probar de forma dirigida y economica, y finalmente lanzar el dataset completo como prueba de regresion.'
                : 'The cost efficiency of the testing system will be evaluated. The strategy should be: first run tests with simple and quick cases to detect obvious errors without spending, then allow selecting subsets within the Golden Dataset (e.g., only those with known errors) for targeted and cost-effective testing, and finally launch the full dataset as a regression test.'}
            </BulletPoint>
            <BulletPoint icon={Filter} title={es ? 'Ejecucion Granular' : 'Granular Execution'}>
              {es
                ? 'Permitir la ejecucion de pruebas sobre documentos individuales, grupos especificos, o aislar una ejecucion solo para los "casos con errores" categorizados en la Fase 1. Poder filtrar por tipo de documento, proveedor, location, o por etiquetas de error.'
                : 'Allow test execution on individual documents, specific groups, or isolate a run only for the "error cases" categorized in Phase 1. Filter by document type, supplier, location, or by error tags.'}
            </BulletPoint>
            <BulletPoint icon={GitBranch} title={es ? 'Pruebas de Regresion' : 'Regression Testing'}>
              {es
                ? 'Una vez resueltos los errores especificos, un boton para lanzar el dataset completo y asegurar que los cambios no han roto el funcionamiento de otros casos.'
                : 'Once specific errors are resolved, a button to launch the full dataset and ensure that changes haven\'t broken other cases.'}
            </BulletPoint>
            <BulletPoint icon={Bell} title={es ? 'Sistema de Alertas y Categorizacion de Errores' : 'Alert System & Error Categorization'}>
              {es
                ? 'El sistema debe avisar claramente cuando se detectan errores, categorizandolos por tipo: errores de extraccion, de normalizacion, de calculo (totales que no cuadran), de duplicados, etc. Un buen sistema de categorizacion permite priorizar que arreglar primero y entender patrones de fallo.'
                : 'The system must clearly alert when errors are detected, categorizing them by type: extraction errors, normalization errors, calculation errors (totals that don\'t match), duplicates, etc. A good categorization system allows prioritizing what to fix first and understanding failure patterns.'}
            </BulletPoint>
            <BulletPoint icon={Scale} title={es ? 'Comparadores Inteligentes' : 'Smart Comparators'}>
              {es
                ? 'Implementar evaluadores con tolerancia a minusculas/mayusculas, fuzzy matching para descripciones, tolerancia numerica (por redondeos de centimos) y match estricto para IDs.'
                : 'Implement evaluators with case-insensitive tolerance, fuzzy matching for descriptions, numeric tolerance (for cent rounding) and strict match for IDs.'}
            </BulletPoint>
          </PhaseCard>

          {/* Phase 3 */}
          <PhaseCard
            number={es ? 'FASE 3' : 'PHASE 3'}
            icon={BarChart3}
            title={es ? 'Zona de Analiticas (Performance Evolution)' : 'Analytics Zone (Performance Evolution)'}
            color="bg-green-50 text-green-900"
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              {es
                ? 'El dashboard donde visualizamos el impacto de los cambios. Se valora un panel de metricas completo y bien disenado donde se pueda detectar la evolucion del rendimiento de forma clara.'
                : 'The dashboard where we visualize the impact of changes. A complete and well-designed metrics panel is valued where performance evolution can be clearly detected.'}
            </p>
            <BulletPoint icon={TrendingUp} title={es ? 'Timeline de Evolucion' : 'Evolution Timeline'}>
              {es
                ? 'Un buen timeline que muestre como ha evolucionado el accuracy y el performance general tras cada ejecucion de evals o cambio de version. Poder ver el antes y el despues de cada cambio de prompt, modelo o logica, con timestamps y etiquetas de version.'
                : 'A solid timeline showing how accuracy and general performance have evolved after each eval run or version change. See the before and after of each prompt, model or logic change, with timestamps and version labels.'}
            </BulletPoint>
            <BulletPoint icon={Layers} title={es ? 'Metricas por Fase del Pipeline' : 'Metrics per Pipeline Phase'}>
              {es
                ? 'Vision detallada del rendimiento para cada paso individual del pipeline (Extraccion, Normalizacion, Conciliacion, etc.). Poder identificar en que fase exacta se producen los fallos.'
                : 'Detailed performance view for each individual pipeline step (Extraction, Normalization, Reconciliation, etc.). Identify in which exact phase failures occur.'}
            </BulletPoint>
            <BulletPoint icon={MapPin} title={es ? 'Locations con Mas Errores' : 'Locations with Most Errors'}>
              {es
                ? 'Poder ver que locations (establecimientos) tienen mas errores. Detectar si hay patrones geograficos o de configuracion que afectan al rendimiento de la IA.'
                : 'See which locations (establishments) have the most errors. Detect if there are geographic or configuration patterns that affect AI performance.'}
            </BulletPoint>
            <BulletPoint icon={Users} title={es ? 'Proveedores con Mas Errores' : 'Suppliers with Most Errors'}>
              {es
                ? 'Filtrar y agrupar metricas por proveedor para detectar si la IA esta fallando sistematicamente con los formatos de un proveedor en concreto. Rankings de proveedores por tasa de error.'
                : 'Filter and group metrics by supplier to detect if the AI is systematically failing with a specific supplier\'s formats. Supplier rankings by error rate.'}
            </BulletPoint>
          </PhaseCard>
        </div>
      </div>

      {/* Our Pipeline */}
      <div>
        <SectionHeader
          icon={Cpu}
          title={es ? 'Nuestro Pipeline (Lo que vais a evaluar)' : 'Our Pipeline (What you will evaluate)'}
          color="bg-purple-50 text-purple-600"
        />
        <p className="text-sm text-gray-500 mb-6">
          {es
            ? 'Nuestro sistema se compone de 4 fases secuenciales. Podreis testear cada una a traves de la API que os daremos:'
            : 'Our system is composed of 4 sequential phases. You will be able to test each one through the API we will provide:'}
        </p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <PipelineStep
            number="01"
            icon={FileCheck}
            title={es ? 'Extraccion (OCR + IA)' : 'Extraction (OCR + AI)'}
            description={es
              ? 'Saca todos los datos de facturas y albaranes en PDF, incluyendo el detalle linea a linea.'
              : 'Extracts all data from invoices and delivery notes in PDF, including line-by-line detail.'}
            color="bg-brand-50 text-brand-600"
          />
          <div className="flex justify-center">
            <ArrowRight size={16} className="text-gray-300" />
          </div>
          <PipelineStep
            number="02"
            icon={Package}
            title={es ? 'Normalizacion (IA)' : 'Normalization (AI)'}
            description={es
              ? 'Recibe las lineas extraidas, identifica que producto es y le asigna nuestro product_id interno (o detecta si no existe).'
              : 'Receives extracted lines, identifies the product and assigns our internal product_id (or detects if it doesn\'t exist).'}
            color="bg-blue-50 text-blue-600"
          />
          <div className="flex justify-center">
            <ArrowRight size={16} className="text-gray-300" />
          </div>
          <PipelineStep
            number="03"
            icon={Scale}
            title={es ? 'Conciliacion de Documentos' : 'Document Reconciliation'}
            description={es
              ? 'Cruza linea a linea las facturas, albaranes y pedidos para asegurar que todo cuadra.'
              : 'Cross-references invoices, delivery notes and orders line by line to ensure everything matches.'}
            color="bg-green-50 text-green-600"
          />
          <div className="flex justify-center">
            <ArrowRight size={16} className="text-gray-300" />
          </div>
          <PipelineStep
            number="04"
            icon={Landmark}
            title={es ? 'Conciliacion Bancaria' : 'Bank Reconciliation'}
            description={es
              ? 'Usa IA para emparejar movimientos bancarios con las facturas correspondientes.'
              : 'Uses AI to match bank transactions with corresponding invoices.'}
            color="bg-purple-50 text-purple-600"
          />
        </div>
      </div>

      {/* Your Arsenal */}
      <div>
        <SectionHeader
          icon={Zap}
          title={es ? 'Vuestro Arsenal (Lo que os entregamos)' : 'Your Arsenal (What we provide)'}
          color="bg-amber-50 text-amber-600"
        />
        <p className="text-sm text-gray-500 mb-6">
          {es
            ? 'Para que podais construir la plataforma desde cero y con la maxima comodidad, os proporcionaremos lo siguiente:'
            : 'So you can build the platform from scratch with maximum comfort, we will provide the following:'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ArsenalItem
            icon={Code2}
            title={es ? 'API de Evaluacion' : 'Evaluation API'}
            description={es
              ? 'Endpoints REST para simular cada paso de nuestro pipeline. Reciben inputs (PDFs o JSONs) y devuelven el output generado por nuestra IA.'
              : 'REST endpoints to simulate each step of our pipeline. They receive inputs (PDFs or JSONs) and return the output generated by our AI.'}
          />
          <ArsenalItem
            icon={FileCheck}
            title={es ? 'Datos Crudos' : 'Raw Data'}
            description={es
              ? 'Un conjunto de PDFs y datos sin etiquetar (unlabeled) para alimentar vuestra plataforma de Human Annotations y empezar a construir el Golden Dataset.'
              : 'A set of PDFs and unlabeled data to feed your Human Annotations platform and start building the Golden Dataset.'}
          />
          <ArsenalItem
            icon={FileCheck}
            title="Swagger / OpenAPI"
            description={es
              ? 'Documentacion tecnica con los esquemas exactos de que recibe y que devuelve cada endpoint de nuestra API.'
              : 'Technical documentation with the exact schemas of what each API endpoint receives and returns.'}
          />
          <ArsenalItem
            icon={Code2}
            title="Claude Code"
            description={es
              ? 'Acceso sin restricciones para acelerar el desarrollo, generar boilerplate y resolver problemas de codigo durante el hackathon.'
              : 'Unrestricted access to accelerate development, generate boilerplate and solve code problems during the hackathon.'}
          />
          <ArsenalItem
            icon={MessageSquare}
            title="Gemini Pro"
            description={es
              ? 'Acceso al modelo para consultas de arquitectura, brainstorming o cualquier tipo de pregunta durante el desarrollo.'
              : 'Model access for architecture queries, brainstorming or any type of question during development.'}
          />
          <ArsenalItem
            icon={Coffee}
            title={es ? 'Supervivencia y Energia' : 'Survival & Energy'}
            description={es
              ? 'Cafe ilimitado, frutos secos y Glovo on demand. Sofas cama y zonas para descansar.'
              : 'Unlimited coffee, nuts and Glovo on demand. Sofa beds and rest areas.'}
          />
          <ArsenalItem
            icon={Users}
            title={es ? 'Soporte Continuo' : 'Continuous Support'}
            description={es
              ? 'El equipo organizador estara disponible para resolver cualquier duda sobre la API, la logica de negocio o la arquitectura.'
              : 'The organizing team will be available to answer any questions about the API, business logic or architecture.'}
          />
        </div>
      </div>
    </div>
  );
}
