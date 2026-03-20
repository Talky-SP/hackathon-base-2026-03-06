import { useState } from 'react';
import {
  Rocket, Terminal, Cloud, GitBranch, Monitor, Eye, EyeOff, Copy, Check,
  Server, Layout, ExternalLink, AlertTriangle, FolderTree, Zap, Info,
  Database, Globe, Code2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

function SecretField({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
      <span className="text-xs font-medium text-gray-500 w-44 shrink-0">{label}</span>
      <code className="text-sm font-mono text-gray-800 flex-1 min-w-0 truncate">
        {visible ? value : '\u2022'.repeat(Math.min(value.length, 24))}
      </code>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setVisible(!visible)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title={visible ? 'Ocultar' : 'Mostrar'}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Copiar"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {title && (
        <div className="bg-gray-800 text-gray-400 text-xs font-mono px-4 py-1.5 rounded-t-lg border-b border-gray-700">
          {title}
        </div>
      )}
      <pre className={`bg-gray-900 text-gray-100 ${title ? 'rounded-b-lg' : 'rounded-lg'} p-4 text-sm overflow-x-auto font-mono leading-relaxed`}>
        <code>{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function StepHeader({ number, icon: Icon, title, color }: {
  number: string; icon: typeof Rocket; title: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${color}`}>
        {number}
      </div>
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-gray-400" />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
    </div>
  );
}

function Collapsible({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: typeof FolderTree; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        <Icon size={16} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </button>
      {open && <div className="p-4 border-t border-gray-200">{children}</div>}
    </div>
  );
}

export default function GettingStartedPage() {
  const { language } = useLanguage();
  const es = language === 'es';

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-12">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl p-8 sm:p-10 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={24} />
            <span className="text-xs font-mono bg-white/20 px-2.5 py-1 rounded-md">
              {es ? 'Primeros Pasos' : 'Getting Started'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {es ? 'Ponte a funcionar' : 'Get up and running'}
          </h1>
          <p className="text-white/80 text-base max-w-2xl">
            {es
              ? 'Sigue estos pasos para configurar tu entorno de desarrollo y empezar a construir.'
              : 'Follow these steps to set up your development environment and start building.'}
          </p>
        </div>
      </div>

      {/* Important clarification about AWS accounts */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-4">
        <Info size={20} className="text-blue-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-blue-900 mb-1">
            {es ? 'Importante: Dos cuentas AWS separadas' : 'Important: Two separate AWS accounts'}
          </h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            {es
              ? 'Las APIs de Talky (TPV, facturas, albaranes, nominas...) que usais en la seccion de Documentacion son recursos en otra cuenta de AWS que no teneis que gestionar. Ya estan desplegadas y funcionando. La cuenta AWS que os damos aqui es vuestra cuenta propia para el hackathon, donde podeis crear bases de datos, lambdas y todo lo que necesiteis para el backend de vuestra plataforma de evals.'
              : 'The Talky APIs (POS, invoices, delivery notes, payrolls...) used in the Documentation section are resources in a different AWS account that you don\'t need to manage. They are already deployed and running. The AWS account we give you here is your own hackathon account, where you can create databases, lambdas and everything you need for your evals platform backend.'}
          </p>
        </div>
      </div>

      {/* Two columns: Backend & Frontend repos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-900 text-white px-6 py-4 flex items-center gap-3">
            <Server size={20} />
            <div>
              <h2 className="text-base font-bold">Backend</h2>
              <p className="text-xs text-gray-400">Python + AWS CDK</p>
            </div>
          </div>
          <div className="p-5">
            <a
              href="https://github.com/Talky-SP/hackathon-backend-base-2026-03-06.git"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              <GitBranch size={14} />
              hackathon-backend-base-2026-03-06
              <ExternalLink size={12} />
            </a>
            <p className="text-xs text-gray-500 mt-2">
              {es ? 'Infraestructura como codigo con CDK, DynamoDB, Lambdas y API Gateway.' : 'Infrastructure as code with CDK, DynamoDB, Lambdas and API Gateway.'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-brand-500 text-white px-6 py-4 flex items-center gap-3">
            <Layout size={20} />
            <div>
              <h2 className="text-base font-bold">Frontend</h2>
              <p className="text-xs text-white/70">React + Vite + TypeScript</p>
            </div>
          </div>
          <div className="p-5">
            <a
              href="https://github.com/Talky-SP/hackathon-base-2026-03-06.git"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              <GitBranch size={14} />
              hackathon-base-2026-03-06
              <ExternalLink size={12} />
            </a>
            <p className="text-xs text-gray-500 mt-2">
              {es ? 'Esta plataforma de evals con React, Tailwind y autenticacion Cognito.' : 'This evals platform with React, Tailwind and Cognito authentication.'}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════ BACKEND SETUP ═══════════════════ */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Server size={20} className="text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">
            {es ? 'Configuracion del Backend' : 'Backend Setup'}
          </h2>
        </div>

        {/* Step 1: Prerequisites */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="1" icon={Monitor} title={es ? 'Requisitos Previos' : 'Prerequisites'} color="bg-brand-50 text-brand-600" />
          <p className="text-sm text-gray-600 mb-4">
            {es ? 'Aseguraos de tener instalado:' : 'Make sure you have installed:'}
          </p>
          <div className="space-y-2">
            {[
              { name: 'Python 3.11+', desc: '' },
              { name: 'Node.js v18+', desc: es ? ' — Necesario para npx cdk' : ' — Required for npx cdk' },
              { name: 'AWS CLI', desc: '', link: 'https://aws.amazon.com/cli/', linkText: es ? 'Descargar' : 'Download' },
            ].map(item => (
              <div key={item.name} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-brand-500" />
                <span className="text-gray-700">
                  <strong>{item.name}</strong>{item.desc}
                  {item.link && (
                    <> — <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 underline">{item.linkText}</a></>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Clone & Setup */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="2" icon={GitBranch} title={es ? 'Configuracion del Repositorio' : 'Repository Setup'} color="bg-blue-50 text-blue-600" />
          <CodeBlock>{`# 1. Clonar el proyecto
git clone https://github.com/Talky-SP/hackathon-backend-base-2026-03-06.git
cd hackathon-backend-base-2026-03-06

# 2. Crear y activar el entorno virtual
python -m venv .venv

# Windows (Git Bash):
source .venv/Scripts/activate
# Mac/Linux:
source .venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt`}</CodeBlock>
        </div>

        {/* Step 3: AWS Credentials */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="3" icon={Cloud} title={es ? 'Credenciales AWS' : 'AWS Credentials'} color="bg-amber-50 text-amber-600" />

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 flex gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              {es ? 'Cada equipo tiene sus propias llaves. No las compartais con otros equipos.' : 'Each team has their own keys. Do not share them with other teams.'}
            </p>
          </div>

          <CodeBlock>{`aws configure --profile ${import.meta.env.VITE_AWS_PROFILE ?? 'hackathon-equipo1'}`}</CodeBlock>

          <div className="mt-5 space-y-6">
            {/* Console */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Monitor size={14} />
                {es ? 'Consola AWS' : 'AWS Console'}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                  <span className="text-xs font-medium text-gray-500 w-44 shrink-0">URL</span>
                  <a href={import.meta.env.VITE_AWS_CONSOLE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-brand-500 hover:text-brand-600 truncate">
                    {import.meta.env.VITE_AWS_CONSOLE_URL?.replace('https://', '')}
                  </a>
                </div>
                <SecretField label={es ? 'Usuario' : 'Username'} value={import.meta.env.VITE_AWS_USERNAME ?? ''} />
                <SecretField label={es ? 'Contrasena' : 'Password'} value={import.meta.env.VITE_AWS_PASSWORD ?? ''} />
              </div>
            </div>

            {/* CLI */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Terminal size={14} />
                {es ? 'Credenciales CLI' : 'CLI Credentials'}
              </h4>
              <div className="space-y-2">
                <SecretField label="Access Key ID" value={import.meta.env.VITE_AWS_ACCESS_KEY_ID ?? ''} />
                <SecretField label="Secret Access Key" value={import.meta.env.VITE_AWS_SECRET_ACCESS_KEY ?? ''} />
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                  <span className="text-xs font-medium text-gray-500 w-44 shrink-0">Region</span>
                  <code className="text-sm font-mono text-gray-800">eu-west-3</code>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                  <span className="text-xs font-medium text-gray-500 w-44 shrink-0">Output</span>
                  <code className="text-sm font-mono text-gray-800">json</code>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 bg-gray-900 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">
              {es ? 'IMPORTANTE: Activar el perfil en la terminal:' : 'IMPORTANT: Activate the profile in your terminal:'}
            </p>
            <code className="text-sm text-green-400 font-mono">export AWS_PROFILE={import.meta.env.VITE_AWS_PROFILE ?? 'hackathon-equipo1'}</code>
          </div>
        </div>

        {/* Step 4: First Deploy */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="4" icon={Rocket} title={es ? 'Primer Despliegue' : 'First Deployment'} color="bg-green-50 text-green-600" />
          <p className="text-sm text-gray-600 mb-4">
            {es ? 'Verificad que todo funciona desplegando la base:' : 'Verify everything works by deploying the base:'}
          </p>
          <CodeBlock>{`# Comprobar que el CDK reconoce el Stack
npx cdk ls

# Desplegar en la nube (2-3 minutos)
npx cdk deploy`}</CodeBlock>
        </div>

        {/* CDK Commands Reference */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="5" icon={Terminal} title={es ? 'Comandos CDK Utiles' : 'Useful CDK Commands'} color="bg-purple-50 text-purple-600" />

          <div className="space-y-3">
            <CodeBlock title={es ? 'Sintetizar (generar CloudFormation)' : 'Synthesize (generate CloudFormation)'}>{`# Synth todos los pipelines
npx cdk synth

# Synth solo dev
npx cdk synth -c pipeline=dev`}</CodeBlock>

            <CodeBlock title={es ? 'Ver diferencias antes de desplegar' : 'Check diff before deploying'}>{`npx cdk diff -c pipeline=dev`}</CodeBlock>

            <CodeBlock title={es ? 'Desplegar el pipeline de dev (self-mutating)' : 'Deploy dev pipeline (self-mutating)'}>{`npx cdk deploy HackathonDevPipelineStack -c pipeline=dev`}</CodeBlock>

            <CodeBlock title={es ? 'Desplegar stacks individuales (iteracion rapida)' : 'Deploy individual stacks (fast iteration)'}>{`npx cdk deploy -c pipeline=dev \\
  HackathonDevPipelineStack/Development/DynamoDBStack \\
  HackathonDevPipelineStack/Development/LambdaStack \\
  HackathonDevPipelineStack/Development/ApiStack`}</CodeBlock>
          </div>
        </div>

        {/* Project Structure */}
        <Collapsible title={es ? 'Estructura del Proyecto Backend' : 'Backend Project Structure'} icon={FolderTree} defaultOpen={false}>
          <pre className="text-xs font-mono text-gray-600 leading-relaxed whitespace-pre">{`hackathon_backend/
  config/environments.py             # ${es ? 'Fuente de verdad: cuentas, regiones, settings' : 'Source of truth: accounts, regions, settings'}
  constructs/
    base_class/base_class_dynamodb.py  # ${es ? 'Base reutilizable de DynamoDB' : 'Reusable DynamoDB base construct'}
    databases/trial_items.py           # ${es ? 'Tabla DynamoDB de prueba' : 'Trial DynamoDB table'}
    lambdas/trial/
      get_items.py                     # GET Lambda construct
      create_item.py                   # POST Lambda construct
    api_gateway/trial_api.py           # REST API construct
  services/
    lambdas/trial/
      talky_get_items/                 # GET /items handler
      talky_create_item/               # POST /items handler
    api_gateway/trial/
      trial_api_service.py             # Route wiring (Lambda <-> API GW)
  stacks/
    dynamodb_stack.py                  # DynamoDB resources
    lambda_stack.py                    # Lambda functions
    api_stack.py                       # API Gateway + Cognito authorizer
    deployment_stage.py                # ${es ? 'Agrupa stacks por entorno' : 'Groups all stacks for one env'}
    pipeline_stack.py                  # Dev/Pre/Prod self-mutating pipelines
app.py                                # CDK entry point`}</pre>
        </Collapsible>

        {/* Adding New Resources */}
        <Collapsible title={es ? 'Como Anadir Nuevos Recursos' : 'How to Add New Resources'} icon={Code2}>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{es ? 'Nueva tabla DynamoDB' : 'New DynamoDB Table'}</h4>
              <ol className="list-decimal list-inside text-gray-600 space-y-1 pl-1">
                <li>{es ? 'Crear construct en' : 'Create construct in'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">constructs/databases/my_table.py</code> ({es ? 'heredar de' : 'inherit'} BaseDynamoDB)</li>
                <li>{es ? 'Anadir a' : 'Add to'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">stacks/dynamodb_stack.py</code></li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{es ? 'Nueva Lambda' : 'New Lambda'}</h4>
              <ol className="list-decimal list-inside text-gray-600 space-y-1 pl-1">
                <li>{es ? 'Crear handler en' : 'Create handler in'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{'services/lambdas/{domain}/talky_{name}/'}</code></li>
                <li>{es ? 'Crear construct en' : 'Create construct in'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{'constructs/lambdas/{domain}/{name}.py'}</code></li>
                <li>{es ? 'Anadir a' : 'Add to'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">stacks/lambda_stack.py</code></li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{es ? 'Nuevas rutas API' : 'New API Routes'}</h4>
              <ol className="list-decimal list-inside text-gray-600 space-y-1 pl-1">
                <li>{es ? 'Crear servicio en' : 'Create service in'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{'services/api_gateway/{domain}/'}</code></li>
                <li>{es ? 'Conectar en' : 'Wire in'} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">stacks/api_stack.py</code></li>
              </ol>
            </div>
          </div>
        </Collapsible>

        {/* Pipelines */}
        <Collapsible title="Pipelines (CI/CD)" icon={GitBranch}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Pipeline</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Branch</th>
                  <th className="text-left py-2 font-medium text-gray-700">Stack Name</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100"><td className="py-2 pr-4">Dev</td><td className="py-2 pr-4"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">develop</code></td><td className="py-2"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">HackathonDevPipelineStack</code></td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4">Pre</td><td className="py-2 pr-4"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">pre</code></td><td className="py-2"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">HackathonPrePipelineStack</code></td></tr>
                <tr><td className="py-2 pr-4">Prod</td><td className="py-2 pr-4"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">main</code></td><td className="py-2"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">HackathonProdPipelineStack</code></td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {es
              ? 'Cada pipeline es self-mutating: cuando cambia el codigo CDK, el pipeline se actualiza a si mismo antes de desplegar los stacks de la aplicacion.'
              : 'Each pipeline is self-mutating: when CDK code changes, the pipeline updates itself before deploying the application stacks.'}
          </p>
        </Collapsible>

        {/* Environment Config */}
        <Collapsible title={es ? 'Configuracion por Entorno' : 'Environment Configuration'} icon={Database}>
          <p className="text-xs text-gray-500 mb-3">
            {es ? 'Todo en' : 'All in'} <code className="bg-gray-100 px-1.5 py-0.5 rounded">hackathon_backend/config/environments.py</code>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Setting</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Dev</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Pre</th>
                  <th className="text-left py-2 font-medium text-gray-700">Prod</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100"><td className="py-2 pr-4">Account</td><td className="py-2 pr-4"><code className="text-xs">131880217295</code></td><td className="py-2 pr-4"><code className="text-xs">222222222222</code></td><td className="py-2"><code className="text-xs">333333333333</code></td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4">Region</td><td className="py-2 pr-4">eu-west-3</td><td className="py-2 pr-4">eu-west-3</td><td className="py-2">eu-west-3</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4">Lambda Memory</td><td className="py-2 pr-4">512 MB</td><td className="py-2 pr-4">1024 MB</td><td className="py-2">1024 MB</td></tr>
                <tr><td className="py-2 pr-4">Removal Policy</td><td className="py-2 pr-4">DESTROY</td><td className="py-2 pr-4">DESTROY</td><td className="py-2">RETAIN</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {es ? 'Patron de nombres:' : 'Resource naming pattern:'} <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{'hackathon-{ResourceName}-{stage}-{last4digits}'}</code>
          </p>
        </Collapsible>
      </div>

      {/* ═══════════════════ TRIAL API ═══════════════════ */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Globe size={20} className="text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">
            {es ? 'Trial API (Prueba de Concepto)' : 'Trial API (Proof of Concept)'}
          </h2>
        </div>

        <p className="text-sm text-gray-600">
          {es
            ? 'La API de prueba ya esta desplegada y expone dos endpoints bajo /items. Usadla para verificar que todo funciona:'
            : 'The trial API is already deployed and exposes two endpoints under /items. Use it to verify everything works:'}
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <Zap size={16} className="text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-green-800 mb-1">Base URL</p>
            <code className="text-sm font-mono text-green-700">https://50hhdb4vva.execute-api.eu-west-3.amazonaws.com/dev</code>
          </div>
        </div>

        {/* GET /items */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold font-mono rounded">GET</span>
            <code className="text-sm font-mono text-gray-800">/items</code>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            {es ? 'Listar todos los items (max 50) o buscar por itemId.' : 'List all items (max 50) or query by itemId.'}
          </p>
          <CodeBlock title={es ? 'Listar todos' : 'List all'}>{`curl https://50hhdb4vva.execute-api.eu-west-3.amazonaws.com/dev/items`}</CodeBlock>
          <div className="mt-3">
            <CodeBlock title={es ? 'Buscar por ID' : 'Query by ID'}>{`curl "https://50hhdb4vva.execute-api.eu-west-3.amazonaws.com/dev/items?itemId=abc-123"`}</CodeBlock>
          </div>
          <div className="mt-3">
            <CodeBlock title="Response">{`{
  "items": [
    {
      "itemId": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-03-06T10:30:00+00:00",
      "name": "My Item",
      "description": "A test item"
    }
  ]
}`}</CodeBlock>
          </div>
        </div>

        {/* POST /items */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold font-mono rounded">POST</span>
            <code className="text-sm font-mono text-gray-800">/items</code>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            {es ? 'Crear un nuevo item.' : 'Create a new item.'}
          </p>
          <CodeBlock title="Request">{`curl -X POST https://50hhdb4vva.execute-api.eu-west-3.amazonaws.com/dev/items \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Item", "description": "A test item"}'`}</CodeBlock>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Campo</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">Tipo</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-700">{es ? 'Requerido' : 'Required'}</th>
                  <th className="text-left py-2 font-medium text-gray-700">{es ? 'Descripcion' : 'Description'}</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4"><code className="text-xs">name</code></td>
                  <td className="py-2 pr-4">string</td>
                  <td className="py-2 pr-4">{es ? 'si' : 'yes'}</td>
                  <td className="py-2">{es ? 'Nombre del item' : 'Item name'}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-xs">description</code></td>
                  <td className="py-2 pr-4">string</td>
                  <td className="py-2 pr-4">no</td>
                  <td className="py-2">{es ? 'Descripcion del item' : 'Item description'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <CodeBlock title="Response (201)">{`{
  "item": {
    "itemId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2026-03-06T10:30:00+00:00",
    "name": "My Item",
    "description": "A test item"
  }
}`}</CodeBlock>
          </div>
        </div>

        {/* How to find API URL */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            {es ? 'Como encontrar la URL de tu API' : 'How to find your API URL'}
          </h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li><strong>AWS Console:</strong> API Gateway {'>'} APIs {'>'} <code className="bg-gray-100 px-1 rounded">hackathon-Trial-API-dev-7295</code> {'>'} Stages {'>'} dev {'>'} Invoke URL</li>
            <li><strong>CLI:</strong> <code className="bg-gray-100 px-1 rounded">aws apigateway get-rest-apis --region eu-west-3</code></li>
          </ul>
        </div>
      </div>

      {/* ═══════════════════ FRONTEND SETUP ═══════════════════ */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Layout size={20} className="text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">
            {es ? 'Configuracion del Frontend' : 'Frontend Setup'}
          </h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="1" icon={Monitor} title={es ? 'Requisitos' : 'Requirements'} color="bg-brand-50 text-brand-600" />
          <div className="space-y-2">
            {['Node.js v18+', 'npm', 'Git'].map(name => (
              <div key={name} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-brand-500" />
                <span className="text-gray-700"><strong>{name}</strong></span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="2" icon={GitBranch} title={es ? 'Clonar e Instalar' : 'Clone & Install'} color="bg-blue-50 text-blue-600" />
          <CodeBlock>{`git clone https://github.com/Talky-SP/hackathon-base-2026-03-06.git
cd hackathon-base-2026-03-06
npm install`}</CodeBlock>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="3" icon={Terminal} title={es ? 'Arrancar en Desarrollo' : 'Start Development'} color="bg-green-50 text-green-600" />
          <CodeBlock>{`npm run dev
# -> http://localhost:5233`}</CodeBlock>
          <p className="text-sm text-gray-500 mt-3">
            {es
              ? 'Incluye hot-reload y proxy para las APIs de Talky (evita CORS en local).'
              : 'Includes hot-reload and proxy for Talky APIs (avoids CORS locally).'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <StepHeader number="4" icon={Rocket} title="Build" color="bg-purple-50 text-purple-600" />
          <CodeBlock>{`npm run build
npm run preview`}</CodeBlock>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Tech Stack</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'React 19', tag: 'UI' },
            { name: 'TypeScript', tag: 'Lang' },
            { name: 'Vite 5', tag: 'Build' },
            { name: 'Tailwind CSS', tag: 'Styles' },
            { name: 'AWS CDK', tag: 'IaC' },
            { name: 'DynamoDB', tag: 'DB' },
            { name: 'Lambda', tag: 'Compute' },
            { name: 'API Gateway', tag: 'API' },
          ].map(({ name, tag }) => (
            <div key={name} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-400">{tag}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
