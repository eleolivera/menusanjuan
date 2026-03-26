"use client";

import { useState, useEffect } from "react";

export default function SalesPlaybook() {
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
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-2xl shadow-lg mb-4">M</div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Playbook de Ventas</h1>
          <p className="mt-2 text-slate-500">Estrategia completa para dominar el mercado de restaurantes en San Juan</p>
        </div>

        {/* Who We Are */}
        <Section title="Quiénes Somos" emoji="🎯" number={1}>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 mb-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>MenuSanJuan</strong> es la plataforma de restaurantes de San Juan. Le damos a cada restaurante su propia página web con menú digital, sistema de pedidos por WhatsApp, gestión de cocina, y analíticas de ventas. <strong>Todo gratis.</strong>
            </p>
          </div>
          <p className="text-sm text-slate-700 mb-3">Lo que ofrecemos:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Página web propia del restaurante",
              "Menú digital con precios y fotos",
              "Pedidos directo por WhatsApp",
              "Sistema de gestión de cocina (Kanban)",
              "Tickets con QR para imprimir",
              "Analíticas de ventas",
              "Ubicación exacta del cliente con mapa",
              "Funciona desde el celular",
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                <span className="text-emerald-500 text-sm mt-0.5">✓</span>
                <span className="text-xs text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Our Pitch */}
        <Section title="Nuestro Pitch (30 segundos)" emoji="💬" number={2}>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
            <p className="text-sm text-slate-800 leading-relaxed italic">
              "Hola, te escribo de MenuSanJuan. Estamos creando páginas gratuitas para todos los restaurantes de San Juan. Básicamente, tus clientes entran a tu página, ven tu menú con precios, eligen lo que quieren, y el pedido les llega directo a tu WhatsApp. Sin comisiones, sin intermediarios, sin tener que descargar ninguna app. ¿Te interesaría tener tu página?"
            </p>
          </div>
          <Tip>Este pitch funciona tanto por WhatsApp como en persona. La clave es "gratis" + "directo a tu WhatsApp" + "sin comisiones".</Tip>
        </Section>

        {/* Why Free */}
        <Section title="¿Por qué gratis?" emoji="🤔" number={3}>
          <p className="text-sm text-slate-700 mb-3">Cuando te pregunten (y van a preguntar), la respuesta es simple:</p>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
            <p className="text-sm text-blue-800 leading-relaxed italic">
              "Estamos arrancando en San Juan y queremos que todos los restaurantes estén en la plataforma. Ahora es 100% gratis. Más adelante vamos a tener opciones premium con más funciones, pero la base siempre va a ser gratuita."
            </p>
          </div>
          <p className="text-sm text-slate-500 mt-3">El modelo a futuro: cobrar una suscripción mensual por funciones premium (analíticas avanzadas, promociones destacadas, múltiples sucursales, integración con delivery propio, etc.). Pero eso es más adelante — ahora la prioridad es llenar la plataforma.</p>
        </Section>

        {/* vs Competition */}
        <Section title="Nosotros vs PedidosYa / Rappi" emoji="⚔️" number={4}>
          <p className="text-sm text-slate-700 mb-3">Si mencionan que ya están en PedidosYa o Rappi:</p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b">
                <th className="px-4 py-2 text-left text-slate-500"></th>
                <th className="px-4 py-2 text-center font-bold text-primary">MenuSanJuan</th>
                <th className="px-4 py-2 text-center text-slate-400">PedidosYa / Rappi</th>
              </tr></thead>
              <tbody>
                {[
                  ["Comisión por pedido", "0%", "20-30%"],
                  ["Costo mensual", "Gratis", "$$$"],
                  ["Quién recibe el pedido", "Tu WhatsApp", "La app"],
                  ["Datos del cliente", "Tuyos", "De la app"],
                  ["Control del menú", "Total", "Limitado"],
                  ["Gestión de cocina", "Incluida", "No"],
                  ["Pagos", "Directos a vos", "La app cobra y paga después"],
                ].map(([label, us, them], i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2 text-slate-700 font-medium">{label}</td>
                    <td className="px-4 py-2 text-center text-primary font-semibold">{us}</td>
                    <td className="px-4 py-2 text-center text-slate-400">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mt-3">
            <p className="text-sm text-emerald-800 italic">"No somos competencia de PedidosYa — somos un complemento. Con nosotros tenés TU página que podés compartir en redes. Los pedidos te llegan directo sin que nadie se quede con un porcentaje."</p>
          </div>
        </Section>

        {/* Target Restaurants */}
        <Section title="A Quién Apuntar" emoji="🎯" number={5}>
          <div className="space-y-3">
            <PriorityTarget level="alta" title="Restaurantes que NO están en apps de delivery"
              desc="Son los más fáciles de convencer. No tienen presencia online, no reciben pedidos digitales. Para ellos esto es pura ganancia." />
            <PriorityTarget level="alta" title="Restaurantes que se quejan de las comisiones de PedidosYa"
              desc="Ya entienden el problema. Nosotros somos la solución: 0% comisión." />
            <PriorityTarget level="media" title="Restaurantes con Instagram/Facebook activo"
              desc="Ya tienen audiencia online pero no un sistema de pedidos. Podemos darles el link para que lo pongan en su bio." />
            <PriorityTarget level="media" title="Restaurantes nuevos / recién abiertos"
              desc="Necesitan todo tipo de ayuda para arrancar. Ofrecerles presencia web gratuita es muy atractivo." />
            <PriorityTarget level="baja" title="Cadenas grandes (McDonald's, Burger King)"
              desc="Ya tienen sus propias apps y sistemas. No son prioridad ahora." />
          </div>
        </Section>

        {/* Outreach Strategy */}
        <Section title="Estrategia de Contacto" emoji="📞" number={6}>
          <h3 className="text-base font-bold text-slate-900 mb-3">Canal #1: WhatsApp Directo (más efectivo)</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 mb-4">
            <li>Buscá restaurantes en Instagram / Google Maps / PedidosYa</li>
            <li>Anotá el número de WhatsApp (está en su perfil de IG o Google)</li>
            <li>Enviá el mensaje de primer contacto (abajo)</li>
            <li>Si responden interesados → enviá el link a su página (si ya la armaste) o preguntá si querés armarla</li>
            <li>Si no responden en 48hs → enviá un follow-up</li>
          </ol>

          <h3 className="text-base font-bold text-slate-900 mb-3">Canal #2: Visita en Persona</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 mb-4">
            <li>Llevá el celular con la demo cargada (menusanjuan.com/hc-cafe u otro)</li>
            <li>Mostrá cómo se ve el menú + cómo llega el pedido por WhatsApp</li>
            <li>Decí: "Te lo armamos gratis, solo necesitamos una foto del menú"</li>
            <li>Sacá foto del menú ahí mismo o pedí que te lo manden por WhatsApp</li>
          </ol>

          <h3 className="text-base font-bold text-slate-900 mb-3">Canal #3: Instagram DM</h3>
          <p className="text-sm text-slate-700 mb-4">Seguí al restaurante, poné like a un par de posts, y después mandá el DM. Es menos efectivo que WhatsApp pero funciona como complemento.</p>
        </Section>

        {/* WhatsApp Messages */}
        <Section title="Mensajes de WhatsApp" emoji="📱" number={7}>
          <div className="space-y-4">
            <MsgTemplate title="Primer contacto" msg={`Hola! 👋

Te escribo de MenuSanJuan. Estamos creando páginas gratuitas para restaurantes de San Juan.

Básicamente: tus clientes entran a tu página, ven el menú con precios, eligen lo que quieren, y el pedido te llega directo a tu WhatsApp. Sin comisiones, sin intermediarios.

¿Te gustaría que te armemos tu página gratis? Solo necesitaríamos una foto de tu menú y listo 🍽️`} />

            <MsgTemplate title="Follow-up (si no responden en 48hs)" msg={`Hola de nuevo! 🙋‍♀️

Te escribí hace unos días sobre MenuSanJuan. Varios restaurantes de la zona ya están usando la plataforma.

Mirá cómo se ve una página de ejemplo:
👉 menusanjuan.com/hc-cafe

Es 100% gratis y se arma en minutos. ¿Te interesa?`} />

            <MsgTemplate title="Si dicen que sí" msg={`Genial! 🎉

Para armar tu página necesito:
📸 Foto del menú (con precios actualizados)
📞 Número de WhatsApp donde querés recibir los pedidos
📍 Dirección del local

Una vez que tenga eso, te armo la página y te mando el link para que la revises. Cualquier cambio se hace al instante.

¿Me lo podés mandar?`} />

            <MsgTemplate title="Cuando la página está lista" msg={`Tu página ya está lista! 🎉

👉 menusanjuan.com/{slug}

Desde ahí tus clientes pueden ver el menú y hacer pedidos directo a tu WhatsApp.

Para gestionar pedidos, modificar precios, y ver tus ventas:
1. Entrá a menusanjuan.com/restaurante/register
2. Registrate con tu email
3. ¡Listo! Desde tu panel podés controlar todo

Tip: Compartí tu link en tus redes sociales y con tus clientes habituales 📲

Cualquier duda me escribís! 💪`} />

            <MsgTemplate title="Si preguntan el costo" msg={`Es 100% gratis 🙌

No hay comisiones por pedido, no hay cuota mensual, no hay letra chica.

Los pedidos te llegan directo a tu WhatsApp, los pagos van directo a vos (efectivo, Mercado Pago, transferencia — lo que vos quieras).

Nosotros ganamos cuando San Juan crece gastronómicamente. Más adelante vamos a tener opciones premium para quienes quieran funciones extra, pero la base siempre va a ser gratuita.`} />

            <MsgTemplate title="Si dicen que ya están en PedidosYa" msg={`Perfecto! MenuSanJuan no reemplaza PedidosYa — es un complemento.

La diferencia principal es que con nosotros:
• 0% comisión (PedidosYa cobra 20-30%)
• Los pedidos llegan a TU WhatsApp
• Vos controlás todo: menú, precios, horarios
• Los datos del cliente son tuyos

Muchos restaurantes lo usan para pedidos directos + PedidosYa para delivery. Así diversifican y no dependen de una sola plataforma.

¿Querés que te armemos la página? Es gratis y se hace en minutos 🍽️`} />
          </div>
        </Section>

        {/* Onboarding Steps */}
        <Section title="Proceso de Onboarding (Paso a Paso)" emoji="📋" number={8}>
          <div className="space-y-4">
            <Step n={1} title="Conseguir el menú" desc="Pedí una foto del menú por WhatsApp, o sacale foto en persona. Si tienen menú en redes, descargalo de ahí." />
            <Step n={2} title="Subir el restaurante" desc="Usá Claude Code con las instrucciones de COWORK_UPLOAD_INSTRUCTIONS.md. Dale la foto del menú y que lo suba. El restaurante se crea INACTIVO." />
            <Step n={3} title="Revisar en admin" desc="Entrá a menusanjuan.com/admin?login → click en el restaurante → revisá nombre, menú, precios. Ajustá lo que haga falta." />
            <Step n={4} title="Activar" desc="En el admin, click 'Activar'. El restaurante aparece en el marketplace." />
            <Step n={5} title="Asignar al dueño" desc="En el admin → Dueño → escribí el email del dueño. Si ya tiene cuenta, se vincula al instante. Si no, se vincula automáticamente cuando se registre." />
            <Step n={6} title="Enviar el link" desc="Mandá el mensaje 'Cuando la página está lista' (arriba) con el link de su página." />
            <Step n={7} title="Seguimiento" desc="A la semana, preguntá cómo les fue. Si necesitan cambios, ayudalos. Si están contentos, pediles que compartan el link en redes." />
          </div>
        </Section>

        {/* Metrics */}
        <Section title="Metas y Métricas" emoji="📊" number={9}>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">Semana 1-2: Primeros 10 restaurantes</h4>
              <p className="text-xs text-slate-600 mt-1">Enfocate en restaurantes que ya conocés o que están cerca. Más fácil cerrar.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">Semana 3-4: 25 restaurantes</h4>
              <p className="text-xs text-slate-600 mt-1">Expandí a zonas nuevas. Usá los primeros restaurantes como referencia ("mirá, estos ya están").</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">Mes 2: 50 restaurantes</h4>
              <p className="text-xs text-slate-600 mt-1">A este punto el marketplace se empieza a vender solo. Los restaurantes ven a otros y quieren estar.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h4 className="text-sm font-bold text-primary">Mes 3+: 100+ restaurantes</h4>
              <p className="text-xs text-slate-600 mt-1">Posición dominante en San Juan. Momento de introducir planes premium.</p>
            </div>
          </div>
        </Section>

        {/* Daily Routine */}
        <Section title="Rutina Diaria Sugerida" emoji="⏰" number={10}>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["9:00 - 10:00", "Buscar restaurantes nuevos (IG, Google Maps, PedidosYa)"],
                  ["10:00 - 11:30", "Enviar mensajes de primer contacto (10-15 restaurantes)"],
                  ["11:30 - 12:30", "Subir menús de restaurantes que respondieron"],
                  ["14:00 - 15:00", "Follow-ups de mensajes anteriores"],
                  ["15:00 - 16:00", "Revisar y activar restaurantes en admin"],
                  ["16:00 - 17:00", "Enviar links a dueños + soporte a restaurantes activos"],
                ].map(([time, task], i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">{time}</td>
                    <td className="px-4 py-2.5 text-slate-700">{task}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Quick Links */}
        <Section title="Links Útiles" emoji="🔗" number={0}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Admin Panel", href: "/admin?login" },
              { label: "Guía Técnica", href: "/admin/guia" },
              { label: "Crear Cuenta (demo)", href: "/restaurante/register" },
              { label: "Login Restaurante", href: "/restaurante/login" },
              { label: "Página Marketing", href: "/para-restaurantes" },
              { label: "Marketplace", href: "/" },
            ].map((l) => (
              <a key={l.href} href={l.href} target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
                {l.label}
              </a>
            ))}
          </div>
        </Section>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">MenuSanJuan — Playbook de Ventas</p>
          <p className="text-xs text-slate-300 mt-1">Vamos a dominar San Juan 🍽️🔥</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, emoji, number, children }: { title: string; emoji: string; number: number; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      {number > 0 ? (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">{number}</div>
          <h2 className="text-xl font-bold text-slate-900">{emoji} {title}</h2>
        </div>
      ) : (
        <h2 className="text-xl font-bold text-slate-900 mb-4">{emoji} {title}</h2>
      )}
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

function PriorityTarget({ level, title, desc }: { level: "alta" | "media" | "baja"; title: string; desc: string }) {
  const colors = { alta: "border-emerald-200 bg-emerald-50", media: "border-blue-200 bg-blue-50", baja: "border-slate-200 bg-slate-50" };
  const labels = { alta: "🟢 Prioridad Alta", media: "🔵 Prioridad Media", baja: "⚪ Prioridad Baja" };
  return (
    <div className={`rounded-xl border p-4 ${colors[level]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{labels[level]}</div>
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-600 mt-1">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{n}</div>
      <div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
