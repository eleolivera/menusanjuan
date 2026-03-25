"use client";

import { useState, useEffect } from "react";

export default function AdminGuide() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetch("/api/admin/restaurants").then((r) => { if (r.ok) setAuthed(true); });
  }, []);

  async function handleLogin() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) setAuthed(true);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h1 className="text-lg font-bold text-white mb-4 text-center">Guía del Admin</h1>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email admin"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none mb-3" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none mb-3" />
          <button onClick={handleLogin}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-sm font-semibold text-white">Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-2xl shadow-lg mb-4">M</div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Guía de Onboarding</h1>
          <p className="mt-2 text-slate-500">Paso a paso para registrar restaurantes y entregarlos a sus dueños</p>
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-10">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Links Rápidos</h2>
          <div className="grid grid-cols-2 gap-2">
            <a href="https://menusanjuan.com/admin" target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
              🔐 Panel Admin
            </a>
            <a href="https://menusanjuan.com/restaurante/register" target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
              ➕ Registrar Restaurante
            </a>
            <a href="https://menusanjuan.com/restaurante/login" target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
              🔑 Login Restaurante
            </a>
            <a href="https://menusanjuan.com/para-restaurantes" target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
              📄 Página Marketing
            </a>
            <a href="https://menusanjuan.com" target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
              🏠 Marketplace
            </a>
            <a href="https://menusanjuan.com/restaurante" target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
              📋 Dashboard Restaurante
            </a>
          </div>
        </div>

        {/* Step 1 */}
        <Section number={1} title="Registrar el Restaurante" emoji="📝">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Andá a <a href="https://menusanjuan.com/restaurante/register" target="_blank" className="text-primary underline">menusanjuan.com/restaurante/register</a></li>
            <li>Usá <strong>tu email</strong> (no el del dueño) — así podés manejar varios restaurantes</li>
            <li>Si ya estás logueada, el sistema agrega el restaurante a tu cuenta automáticamente</li>
            <li>Completá: nombre, WhatsApp del restaurante, tipo de cocina, dirección</li>
            <li>Subí el logo y foto de portada (podés pegar un link de Instagram — se descarga automáticamente)</li>
            <li>Click en <strong>Crear mi Restaurante</strong></li>
          </ol>
          <Tip>Si el restaurante ya existe en la plataforma, en el paso 2 podés elegirlo y reclamarlo en vez de crear uno nuevo.</Tip>
        </Section>

        {/* Step 2 */}
        <Section number={2} title="Armar el Menú" emoji="🍽️">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>En el menú desplegable de arriba a la derecha, hacé click en el restaurante</li>
            <li>Elegí <strong>Mi Menú</strong></li>
            <li>Click <strong>+ Categoría</strong> — creá secciones: Platos Principales, Bebidas, Postres, etc.</li>
            <li>Dentro de cada categoría, click <strong>+ Item</strong></li>
            <li>Para cada item completá: <strong>Nombre</strong>, <strong>Precio</strong>, Descripción (opcional), Imagen (opcional), Badge (Popular/Nuevo)</li>
            <li>Podés marcar items como <strong>No disponible</strong> con el ojo</li>
            <li>El menú se actualiza en tiempo real en la página pública</li>
          </ol>
          <Tip>Para la imagen del item, podés pegar un link de Instagram/Google o subir una foto directamente.</Tip>
        </Section>

        {/* Step 3 */}
        <Section number={3} title="Configurar Perfil y Horarios" emoji="⚙️">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Menú desplegable → <strong>Mi Restaurante</strong></li>
            <li>Completá la <strong>descripción</strong> — 1-2 líneas sobre qué hacen mejor</li>
            <li>Configurá los <strong>horarios de atención</strong> — día por día, hora de apertura y cierre</li>
            <li>Si tienen Mercado Pago, poné el <strong>Alias</strong> y <strong>CVU</strong></li>
            <li>Verificá que la <strong>dirección</strong> esté bien (usa el autocomplete de Google)</li>
            <li>Click <strong>Guardar</strong></li>
          </ol>
        </Section>

        {/* Step 4 */}
        <Section number={4} title="Probar el Sistema" emoji="🧪">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Menú desplegable → <strong>Ver Página Pública</strong></li>
            <li>Verificá que el menú se vea bien, los precios estén correctos</li>
            <li>Hacé un pedido de prueba — agregá items, completá tus datos, enviá por WhatsApp</li>
            <li>Verificá que el pedido llegue al WhatsApp del restaurante</li>
            <li>Andá a <strong>Pedidos</strong> y verificá que aparezca en el Kanban</li>
            <li>Probá mover el pedido entre columnas (arrastralo)</li>
            <li>Abrí un pedido y verificá el ticket con los QR codes</li>
          </ol>
        </Section>

        {/* Step 5 */}
        <Section number={5} title="Entregar al Dueño" emoji="🤝">
          <p className="text-sm text-slate-700 mb-3">Hay dos formas de entregar el restaurante:</p>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
            <h4 className="text-sm font-bold text-emerald-800 mb-2">Opción A — Cambiar Email (más simple)</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-emerald-700">
              <li>Mi Restaurante → scroll hasta <strong>Cuenta y Acceso</strong></li>
              <li>Cambiá el email al del dueño</li>
              <li>Poné una contraseña nueva</li>
              <li>Enviá las credenciales por WhatsApp</li>
            </ol>
            <p className="text-xs text-emerald-600 mt-2">⚠️ Perdés acceso a ese restaurante desde tu cuenta (pero seguís viendo todo desde /admin)</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h4 className="text-sm font-bold text-blue-800 mb-2">Opción B — Reclamo con Código (más profesional)</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
              <li>Decile al dueño que vaya a <strong>menusanjuan.com/{'{'}slug{'}'}</strong></li>
              <li>Van a ver <strong>"¿Es tu restaurante?"</strong> — que haga click en Reclamar</li>
              <li>Si no tiene cuenta, se registra con su email</li>
              <li>Vos vas a <a href="https://menusanjuan.com/admin" target="_blank" className="underline">menusanjuan.com/admin</a> → Reclamos</li>
              <li>Click <strong>Generar Código</strong> → copiá el código de 6 caracteres</li>
              <li>Enviá el código al dueño por WhatsApp</li>
              <li>El dueño ingresa el código en la página del restaurante</li>
              <li>Listo — el restaurante pasa a su cuenta</li>
            </ol>
            <p className="text-xs text-blue-600 mt-2">✅ Vos seguís con acceso desde /admin y podés ayudar cuando necesiten</p>
          </div>
        </Section>

        {/* Email Templates */}
        <Section number={6} title="Mensajes para Enviar" emoji="📨">
          <div className="space-y-4">
            <EmailTemplate
              title="WhatsApp — Invitar al restaurante"
              message={`Hola! 👋

Te escribo de *MenuSanJuan*. Creamos una página gratuita para tu restaurante donde tus clientes pueden ver tu menú y hacer pedidos directo por WhatsApp.

Ya está todo armado, tu página es:
👉 menusanjuan.com/{slug}

Para que puedas manejar los pedidos, modificar precios y ver las ventas, necesitás reclamar tu restaurante:

1. Entrá a menusanjuan.com/{slug}
2. Hacé click en "¿Es tu restaurante?"
3. Registrate con tu email
4. Te voy a mandar un código de verificación

Es 100% gratis. Sin comisiones, sin intermediarios. Los pedidos llegan directo a tu WhatsApp.

¿Te interesa? 🍽️`}
            />

            <EmailTemplate
              title="WhatsApp — Enviar código de verificación"
              message={`Hola! Tu código de verificación para reclamar tu restaurante en MenuSanJuan es:

🔑 *{CODIGO}*

Ingresalo en tu página: menusanjuan.com/{slug}

Con esto ya podés:
✅ Gestionar pedidos desde tu celular
✅ Modificar el menú y precios
✅ Ver analíticas de ventas
✅ Imprimir tickets con QR

Cualquier duda me escribís! 🙌`}
            />

            <EmailTemplate
              title="WhatsApp — Después de la entrega"
              message={`Listo! Ya sos el dueño de tu página en MenuSanJuan 🎉

Tu link: menusanjuan.com/{slug}

Para entrar a tu panel:
👉 menusanjuan.com/restaurante/login
📧 {email del dueño}
🔑 {contraseña}

Desde ahí podés:
📋 Ver y gestionar pedidos
🍽️ Modificar tu menú
📊 Ver analíticas de ventas
⚙️ Cambiar horarios, fotos, datos de pago

Tip: Compartí tu link en tus redes y con tus clientes. Pueden pedir directo desde ahí!

Cualquier duda, acá estoy 💪`}
            />
          </div>
        </Section>

        {/* Daily Operations */}
        <Section number={7} title="Operación Diaria del Restaurante" emoji="📱">
          <p className="text-sm text-slate-700 mb-3">Esto es lo que le explicás al dueño sobre cómo usar el sistema día a día:</p>
          <div className="space-y-3">
            <OpItem emoji="📋" title="Pedidos (Kanban)" desc="Los pedidos llegan automáticamente. Arrastralos entre columnas: Generado → Pagado → En Cocina → Entregado. Se puede usar desde un celular o tablet." />
            <OpItem emoji="🖨️" title="Tickets" desc="Cada pedido se puede expandir para ver el ticket estilo recibo. Tiene QR de WhatsApp (para contactar al cliente) y QR de Google Maps (para la dirección de entrega). Se puede imprimir." />
            <OpItem emoji="📊" title="Analíticas" desc="En Analíticas pueden ver ventas del día, semana, o mes. Top productos, hora pico, ticket promedio. El lunes pueden imprimir el reporte del fin de semana." />
            <OpItem emoji="🍽️" title="Menú" desc="Pueden agregar/quitar items, cambiar precios, marcar items como no disponibles. Los cambios se ven al instante en la página pública." />
            <OpItem emoji="📅" title="Día de negocio" desc="El día de negocio va de 8:00 AM a 5:59 AM del día siguiente. Pedidos de madrugada cuentan como el día anterior. Los números de pedido se reinician cada día (ORD-0325-001)." />
            <OpItem emoji="🧾" title="Consumo" desc="La tabla de consumo muestra cuánto se pidió de cada producto — útil para planificar compras y preparación." />
          </div>
        </Section>

        {/* Multiple Restaurants */}
        <Section number={8} title="Manejar Varios Restaurantes" emoji="🔄">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Desde el menú desplegable arriba a la derecha, hacé click en tu cuenta</li>
            <li>Vas a ver la sección <strong>Mis Restaurantes</strong> con todos los que tenés</li>
            <li>Click en uno para cambiar — el dashboard, menú, y analíticas cambian al restaurante seleccionado</li>
            <li>Para agregar uno nuevo: <strong>+ Agregar restaurante</strong></li>
            <li>Cada restaurante tiene su propia URL, menú, pedidos, y analíticas</li>
          </ol>
        </Section>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
          MenuSanJuan — Guía interna para el equipo de ventas
        </div>
      </div>
    </div>
  );
}

function Section({ number, title, emoji, children }: { number: number; title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">{number}</div>
        <h2 className="text-xl font-bold text-slate-900">{emoji} {title}</h2>
      </div>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
      💡 <strong>Tip:</strong> {children}
    </div>
  );
}

function EmailTemplate({ title, message }: { title: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-medium text-primary hover:underline"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap bg-white font-sans leading-relaxed">{message}</pre>
    </div>
  );
}

function OpItem({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <span className="text-xl shrink-0">{emoji}</span>
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
