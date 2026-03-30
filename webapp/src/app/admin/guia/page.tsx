"use client";

import { useState, useEffect } from "react";

export default function AdminGuide() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => { if (r.ok) setAuthed(true); setChecking(false); })
      .catch(() => setChecking(false));
  }, []);

  if (checking) return <div className="min-h-screen bg-slate-950" />;
  if (!authed) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-600 text-sm">Acceso restringido</p></div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-2xl shadow-lg mb-4">M</div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Guía del Admin</h1>
          <p className="mt-2 text-slate-500">Todo lo que necesitás saber para gestionar MenuSanJuan</p>
        </div>

        {/* Quick Links */}
        <Section title="Links Rápidos" emoji="🔗" number={0}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Admin Panel", href: "/admin?login" },
              { label: "Registrar Restaurante", href: "/restaurante/register" },
              { label: "Login Restaurante", href: "/restaurante/login" },
              { label: "Página Marketing", href: "/para-restaurantes" },
              { label: "Marketplace", href: "/" },
              { label: "Esta Guía", href: "/admin/guia" },
            ].map((l) => (
              <a key={l.href} href={l.href} target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
                {l.label}
              </a>
            ))}
          </div>
        </Section>

        <Section title="Agregar un Restaurante (Admin)" emoji="➕" number={1}>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Ir a <a href="/admin?login" target="_blank" className="text-primary underline">Admin Panel</a></li>
            <li>Click el botón <strong>+ Nuevo</strong> arriba a la derecha de la tabla. Poné nombre y WhatsApp. Te lleva directo a la página del restaurante para completar todo.</li>
            <li>Completá: nombre, teléfono, dirección, tipo de cocina, descripción</li>
            <li>En la pestaña <strong>Menú</strong>: creá categorías y agregá items con precios</li>
            <li>El restaurante queda como <strong>sin reclamar</strong> (placeholder) hasta que un dueño lo tome</li>
          </ol>
        </Section>

        <Section title="Asignar un Dueño" emoji="👤" number={2}>
          <p className="text-sm text-slate-700 mb-3">Hay 3 formas de asignar un dueño a un restaurante:</p>

          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h4 className="text-sm font-bold text-emerald-800 mb-1">A — Asignar por email (usuario existente)</h4>
              <ol className="list-decimal list-inside text-sm text-emerald-700 space-y-1">
                <li>Admin → click en restaurante → pestaña <strong>Dueño</strong></li>
                <li>Escribí el email del dueño → <strong>Asignar</strong></li>
                <li>Si el usuario existe → se vincula <strong>inmediatamente</strong></li>
              </ol>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h4 className="text-sm font-bold text-blue-800 mb-1">B — Asignar por email (usuario NO existe todavía)</h4>
              <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                <li>Admin → click en restaurante → pestaña <strong>Dueño</strong></li>
                <li>Escribí el email → <strong>Asignar</strong></li>
                <li>El email queda guardado como <strong>dueño pendiente</strong></li>
                <li>Cuando esa persona se registre con ese email → el restaurante se asigna <strong>automáticamente</strong></li>
                <li>No necesitan hacer nada extra — se registran y listo, el restaurante aparece en su cuenta</li>
              </ol>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-bold text-amber-800 mb-1">C — Reclamo con código (el dueño inicia el proceso)</h4>
              <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1">
                <li>El dueño visita la página del restaurante (ej: menusanjuan.com/puerto-pachatas)</li>
                <li>Hace click en <strong>"¿Es tu restaurante?"</strong></li>
                <li>Se registra (si no tiene cuenta) y envía un reclamo</li>
                <li>Vos vas a Admin → pestaña <strong>Reclamos</strong> → <strong>Generar Código</strong></li>
                <li>Le mandás el código por WhatsApp</li>
                <li>El dueño ingresa el código → el restaurante se vincula</li>
              </ol>
            </div>
          </div>
        </Section>

        <Section title="Quitar un Dueño" emoji="🔄" number={3}>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Admin → click en restaurante → pestaña <strong>Dueño</strong></li>
            <li>Click <strong>Quitar dueño</strong></li>
            <li>El restaurante vuelve a estar sin reclamar (placeholder)</li>
            <li>Podés asignar otro dueño o dejarlo disponible para reclamo</li>
          </ol>
        </Section>

        <Section title="Activar / Desactivar / Eliminar Restaurantes" emoji="🔘" number={4}>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Admin → pestaña <strong>Restaurantes</strong></li>
            <li>Cada restaurante tiene botones de <strong>Activar/Desactivar</strong> y <strong>Eliminar</strong></li>
            <li><strong>Desactivar</strong>: el restaurante no aparece en el marketplace pero no se borra</li>
            <li><strong>Activar</strong>: el restaurante aparece en el marketplace</li>
            <li><strong>Eliminar</strong>: borra el restaurante permanentemente (pide confirmación)</li>
            <li>Los restaurantes nuevos (subidos por script o creados) empiezan <strong>inactivos</strong></li>
          </ol>
          <Tip>Siempre desactivá en vez de eliminar, a menos que estés segura de que no se necesita más.</Tip>
        </Section>

        <Section title="Gestionar Usuarios" emoji="👥" number={5}>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Admin → pestaña <strong>Usuarios</strong></li>
            <li><strong>Cambiar rol</strong>: usá el dropdown para cambiar entre USER, BUSINESS, ADMIN</li>
            <li><strong>Eliminar usuario</strong>: borra el usuario y todos sus datos (no se puede eliminar un admin)</li>
            <li>Los roles significan:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li><strong>USER</strong> — usuario regular, puede hacer pedidos</li>
                <li><strong>BUSINESS</strong> — dueño de restaurante, puede gestionar su negocio</li>
                <li><strong>ADMIN</strong> — acceso total al panel de admin</li>
              </ul>
            </li>
          </ol>
        </Section>

        <Section title="Gestionar el Menú (Admin)" emoji="🍽️" number={6}>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Admin → click en restaurante → pestaña <strong>Menú</strong></li>
            <li><strong>+ Categoría</strong>: poné emoji + nombre (ej: 🍔 Hamburguesas)</li>
            <li><strong>+ Item</strong>: dentro de cada categoría, nombre + precio</li>
            <li><strong>✓/✗</strong>: toggle disponibilidad de cada item</li>
            <li><strong>✕</strong>: eliminar item o categoría</li>
            <li>Los cambios se reflejan inmediatamente en la página pública</li>
            <li>✏️ Click en el nombre de una categoría para editarlo (nombre y emoji)</li>
            <li>📸 Upload de imágenes: click &quot;Subir imagen&quot; al agregar o editar items</li>
            <li>🎥 Soporta imágenes y videos (mp4)</li>
          </ol>
        </Section>

        <Section title="Mensajes para WhatsApp" emoji="📱" number={7}>
          <div className="space-y-4">
            <MsgTemplate title="Invitar a un restaurante" msg={`Hola! 👋\n\nTe escribo de *MenuSanJuan*. Creamos una página gratuita para tu restaurante donde tus clientes pueden ver tu menú y hacer pedidos directo por WhatsApp.\n\nYa está todo armado, tu página es:\n👉 menusanjuan.com/{slug}\n\nPara manejar los pedidos y modificar el menú, registrate con tu email en:\n👉 menusanjuan.com/restaurante/register\n\nEs 100% gratis. Sin comisiones.\n\n¿Te interesa? 🍽️`} />
            <MsgTemplate title="Enviar código de verificación" msg={`Hola! Tu código de verificación para reclamar tu restaurante en MenuSanJuan es:\n\n🔑 *{CODIGO}*\n\nIngresalo en tu página: menusanjuan.com/{slug}\n\nCon esto ya podés gestionar todo desde tu celular. 🙌`} />
            <MsgTemplate title="Después de la entrega" msg={`Listo! Ya sos el dueño de tu página en MenuSanJuan 🎉\n\nTu link: menusanjuan.com/{slug}\n\nPara entrar a tu panel:\n👉 menusanjuan.com/restaurante/login\n📧 {email}\n🔑 {contraseña}\n\nDesde ahí podés:\n📊 Ver analíticas\n📋 Gestionar pedidos\n🍽️ Modificar el menú\n⚙️ Cambiar horarios y datos\n\nCompartí tu link en redes! 💪`} />
          </div>
        </Section>

        <Section title="Operación Diaria del Restaurante" emoji="📋" number={8}>
          <div className="space-y-3">
            {[
              { emoji: "📊", title: "Dashboard", desc: "Analíticas de ventas. Acceso desde el sidebar: /restaurante/dashboard" },
              { emoji: "📋", title: "Pedidos (Kanban)", desc: "Arrastrá pedidos entre columnas: Generado → Pagado → En Cocina → Entregado. Auto-refresca cada 10s." },
              { emoji: "🖨️", title: "Tickets", desc: "Expandí un pedido para ver el ticket. QR de WhatsApp + Google Maps. Botón Imprimir para térmica 80mm." },
              { emoji: "🍽️", title: "Menú", desc: "Agregar/quitar items, cambiar precios, marcar no disponible. Cambios al instante." },
              { emoji: "⚙️", title: "Mi Restaurante", desc: "Primera página al entrar. Logo, portada, WhatsApp con validación, horarios, ubicación con mapa." },
              { emoji: "🛵", title: "Delivery", desc: "Configurá zonas de delivery (cerca/lejos) con radio y precio, o tarifa fija. Los clientes eligen entre delivery y retiro en local." },
              { emoji: "📅", title: "Día de negocio", desc: "8:00 AM a 5:59 AM. Pedidos de madrugada cuentan como el día anterior. Números se reinician cada día." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="text-xl shrink-0">{item.emoji}</span>
                <div><h4 className="text-sm font-semibold text-slate-900">{item.title}</h4><p className="text-xs text-slate-600 mt-0.5">{item.desc}</p></div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Credenciales" emoji="🔐" number={9}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>Las credenciales del admin se configuran por variables de entorno (ADMIN_EMAIL, ADMIN_PASSWORD). No se muestran acá por seguridad.</p>
          </div>
        </Section>

        <Section title="Delivery y Retiro" emoji="🛵" number={10}>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Admin → click en restaurante → Info → sección <strong>Delivery</strong></li>
            <li>Toggle ON/OFF para habilitar delivery</li>
            <li><strong>Zona cercana</strong>: radio en km + precio en $</li>
            <li><strong>Zona lejana</strong>: radio en km + precio en $</li>
            <li>Si no ponés zonas, usá la <strong>tarifa fija</strong> (mismo precio para todos)</li>
            <li>Si no ponés nada, el cliente ve &quot;Consultá con el restaurante&quot;</li>
            <li>El restaurante necesita coordenadas (ubicación en mapa) para que las zonas funcionen</li>
            <li>Los clientes siempre pueden elegir <strong>Retiro en local</strong> (gratis)</li>
          </ol>
          <Tip>Hovereá el ícono ⓘ junto a &quot;Delivery&quot; en el admin para ver la explicación rápida.</Tip>
        </Section>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
          MenuSanJuan — Guía interna
        </div>
      </div>
    </div>
  );
}

function Section({ title, emoji, number, children }: { title: string; emoji: string; number: number; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      {number > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">{number}</div>
          <h2 className="text-xl font-bold text-slate-900">{emoji} {title}</h2>
        </div>
      )}
      {number === 0 && <h2 className="text-xl font-bold text-slate-900 mb-4">{emoji} {title}</h2>}
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

function MsgTemplate({ title, msg }: { title: string; msg: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-medium text-primary hover:underline">{copied ? "✓ Copiado" : "Copiar"}</button>
      </div>
      <pre className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap bg-white font-sans leading-relaxed">{msg}</pre>
    </div>
  );
}
