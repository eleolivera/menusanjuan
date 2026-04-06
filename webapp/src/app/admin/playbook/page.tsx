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
          <p className="mt-2 text-slate-500">Guia completa para sumar restaurantes a MenuSanJuan</p>
        </div>

        {/* What we have right now */}
        <Section title="Donde Estamos" emoji="🚀" number={0}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat value="82+" label="Restaurantes" />
            <Stat value="18" label="Tipos de cocina" />
            <Stat value="865+" label="Imagenes en CDN" />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Ya tenemos 82 restaurantes importados desde PedidosYa con menus, fotos, direcciones y telefonos. La plataforma esta lista — falta convertir esos restaurantes en duenos activos y sumar nuevos.
          </p>
        </Section>

        {/* Who We Are */}
        <Section title="Quienes Somos" emoji="🎯" number={1}>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 mb-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>MenuSanJuan</strong> es la plataforma de pedidos para restaurantes de San Juan. Cada restaurante tiene su propia pagina web con menu digital, sistema de pedidos por WhatsApp, opciones personalizables (gustos, extras, tamanos), Kanban de cocina, y analiticas. <strong>100% gratis. Sin comisiones.</strong>
            </p>
          </div>
          <p className="text-sm text-slate-700 mb-3">Que ofrecemos hoy:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Pagina web propia (menusanjuan.com/{slug})",
              "Menu digital con fotos, videos, descripciones",
              "Opciones personalizables (gustos de helado, extras, tamanos)",
              "Pedidos directo por WhatsApp",
              "Kanban de pedidos: Nuevo → Pagado → Cocina → Entregado",
              "Tickets QR para imprimir",
              "Mapas con ubicacion del cliente",
              "Delivery por zonas (cerca / lejos / pickup)",
              "Mercado Pago + efectivo + transferencia",
              "Horarios de atencion configurables",
              "Funciona desde el celular",
              "Login del dueno con codigo de acceso (sin contrasenas para acordarse)",
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                <span className="text-emerald-500 text-sm mt-0.5">✓</span>
                <span className="text-xs text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Kanban Onboarding Flow */}
        <Section title="El Flujo de Onboarding (Tablero)" emoji="📋" number={2}>
          <p className="text-sm text-slate-700 mb-4">El Tablero de admin tiene 5 columnas. Cada restaurante se mueve por estas etapas:</p>
          <div className="space-y-2">
            <KanbanStage color="amber" name="Falta info" desc="Restaurantes a los que les faltan fotos, direccion, WhatsApp o menu. Los arreglas ahi mismo desde el modal." />
            <KanbanStage color="blue" name="Listo" desc="Info completa, listos para contactar al dueno. Filtras por aca cuando estas en modo outreach." />
            <KanbanStage color="purple" name="Cola de contacto" desc="En cola para enviar el WhatsApp con el codigo de acceso. Aca activas la cuenta." />
            <KanbanStage color="cyan" name="En charla" desc="Ya contactamos, esperando respuesta. Tira la ubicacion del codigo, datos del dueno, etc." />
            <KanbanStage color="emerald" name="Onboardeado" desc="Activo y verificado. El dueno ya entro, eligio su contrasena y maneja todo." />
          </div>
          <Tip>El boton "Solo outreach" en el tablero esconde "Falta info" y "Listo" para enfocarte solo en los que estan en proceso de contacto.</Tip>
        </Section>

        {/* Pitch */}
        <Section title="Nuestro Pitch (30 segundos)" emoji="💬" number={3}>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
            <p className="text-sm text-slate-800 leading-relaxed italic">
              "Hola, te escribo de MenuSanJuan. Te creamos una pagina gratuita para tu restaurante donde tus clientes pueden ver el menu completo con precios y hacer pedidos directo por WhatsApp. Sin intermediarios, sin comisiones — a diferencia de otras apps que se quedan con un porcentaje de cada venta, con nosotros todo lo que vendes es tuyo. ¿Te interesa que te pase el link?"
            </p>
          </div>
          <Tip>Las palabras clave: "gratuita", "directo a tu WhatsApp", "0 comisiones", "todo lo que vendes es tuyo".</Tip>
        </Section>

        {/* vs Competition */}
        <Section title="Nosotros vs PedidosYa / Rappi" emoji="⚔️" number={4}>
          <p className="text-sm text-slate-700 mb-3">Si mencionan que ya estan en PedidosYa o Rappi:</p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b">
                <th className="px-4 py-2 text-left text-slate-500"></th>
                <th className="px-4 py-2 text-center font-bold text-primary">MenuSanJuan</th>
                <th className="px-4 py-2 text-center text-slate-400">PedidosYa / Rappi</th>
              </tr></thead>
              <tbody>
                {[
                  ["Comision por pedido", "0%", "20-30%"],
                  ["Costo mensual", "Gratis", "$$$"],
                  ["Quien recibe el pedido", "Tu WhatsApp", "La app"],
                  ["Datos del cliente", "Tuyos", "De la app"],
                  ["Control del menu", "Total", "Limitado"],
                  ["Opciones (gustos, extras)", "Si", "Limitado"],
                  ["Kanban de cocina", "Incluido", "No"],
                  ["Pagos", "Directos a vos", "La app cobra y paga despues"],
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
            <p className="text-sm text-emerald-800 italic">"No somos competencia de PedidosYa — somos un complemento. Con nosotros tenes TU pagina que podes compartir en redes. Los pedidos te llegan directo sin que nadie se quede con un porcentaje."</p>
          </div>
        </Section>

        {/* Target */}
        <Section title="A Quien Apuntar" emoji="🎯" number={5}>
          <div className="space-y-3">
            <PriorityTarget level="alta" title="Restaurantes que ya estan en el Tablero (82 importados)"
              desc="Ya tienen pagina, menu y fotos cargados. Solo falta contactar al dueno y entregarle el codigo. Es el camino mas rapido. Estan en la columna 'Listo' o 'Cola de contacto'." />
            <PriorityTarget level="alta" title="Restaurantes que se quejan de las comisiones de PedidosYa"
              desc="Ya entienden el problema. Nosotros somos la solucion: 0% comision." />
            <PriorityTarget level="media" title="Restaurantes con Instagram/Facebook activo"
              desc="Ya tienen audiencia online pero no un sistema de pedidos. Podemos darles el link para que lo pongan en su bio." />
            <PriorityTarget level="media" title="Restaurantes nuevos / recien abiertos"
              desc="Necesitan todo tipo de ayuda para arrancar. Ofrecerles presencia web gratuita es muy atractivo." />
            <PriorityTarget level="baja" title="Cadenas grandes (McDonald's, Burger King)"
              desc="Ya tienen sus propias apps y sistemas. No son prioridad ahora." />
          </div>
        </Section>

        {/* Process: from card to onboarded */}
        <Section title="Proceso Completo (de tarjeta a onboardeado)" emoji="📋" number={6}>
          <div className="space-y-4">
            <Step n={1} title="Abri el Tablero"
              desc="Anda a admin.menusanjuan.com → Tablero. Por defecto te muestra solo 'Cola de contacto', 'En charla' y 'Onboardeado' (modo outreach)." />
            <Step n={2} title="Filtra por 'Listo'"
              desc="Apaga 'Solo outreach' para ver tambien los restaurantes con info completa que esperan ser contactados." />
            <Step n={3} title="Click en una tarjeta"
              desc="Se abre el modal del restaurante con tabs: Info, Menu, Dueno, Pedidos. Revisa que todo este bien (logo, fotos, direccion, telefono, menu)." />
            <Step n={4} title="Verifica la ubicacion"
              desc="En la tab Info, click 'Mapa' y ajusta la ubicacion del restaurante con el LocationPicker. Esto guarda las coordenadas para los QR de pedidos." />
            <Step n={5} title="Editar el menu si hace falta"
              desc="En la tab Menu podes agregar/editar items, subir imagenes (drag and drop), y configurar opciones como gustos de helado, extras, tamanos." />
            <Step n={6} title="Mover la tarjeta a 'Cola de contacto'"
              desc="Arrastra la tarjeta desde Listo. Esto la prepara para activar." />
            <Step n={7} title="Click en 'Activar'"
              desc="Se genera un codigo de 6 letras (ej: KT4VB9). El codigo se guarda en la tarjeta y queda listo para enviar." />
            <Step n={8} title="Click en 'WhatsApp'"
              desc="Se abre el popup con el mensaje pre-armado. Revisalo, modificalo si queres, y click en 'Enviar por WhatsApp'. Te abre wa.me con todo cargado." />
            <Step n={9} title="La tarjeta se mueve a 'En charla' automaticamente"
              desc="Cuando manda el WhatsApp, la tarjeta cambia de columna sola." />
            <Step n={10} title="Esperar al dueno"
              desc="El dueno entra a menusanjuan.com/restaurante/login con su email + el codigo. La primera vez se le pide elegir contrasena propia o crear una cuenta nueva con su email personal." />
            <Step n={11} title="Verificacion automatica"
              desc="Cuando el dueno completa el setup, la tarjeta se mueve sola a 'Onboardeado' y se agrega una nota automatica con el resultado." />
            <Step n={12} title="Seguimiento"
              desc="A la semana, agrega una nota a la tarjeta preguntando como les fue. Si necesitan cambios o ayuda con el menu, podes editar todo desde el admin." />
          </div>
        </Section>

        {/* WhatsApp Templates */}
        <Section title="Mensajes de WhatsApp" emoji="📱" number={7}>
          <p className="text-sm text-slate-700 mb-4">El boton "WhatsApp" en cada tarjeta del Tablero ya genera el mensaje principal automaticamente, pero estos son los templates que podes usar manualmente o copiar y pegar:</p>
          <div className="space-y-4">
            <MsgTemplate title="Mensaje de activacion (auto-generado)" msg={`Hola! Soy de MenuSanJuan.com

Te creamos una pagina gratuita para *{nombre del resto}* donde tus clientes pueden ver el menu completo con precios y hacer pedidos directo por WhatsApp. Sin intermediarios, sin comisiones — a diferencia de otras apps que se quedan con un porcentaje de cada venta, con nosotros todo lo que vendes es tuyo.

Ya esta armada con tu menu cargado:
{nombre}: menusanjuan.com/{slug}

Para entrar a tu panel y gestionar todo:
menusanjuan.com/restaurante/login
Email: {email}
Codigo de acceso: {codigo}

La primera vez que entres te va a pedir que elijas tu propia contrasena.

Si tenes la carta actualizada con los precios de hoy, mandamela asi la actualizamos rapido.

Cualquier duda te ayudamos por aca, por llamada, o podemos pasar por el local. Estamos para hacerte las cosas faciles!`} />

            <MsgTemplate title="Follow-up (3 dias sin respuesta)" msg={`Hola de nuevo!

Te escribi hace unos dias sobre tu pagina en MenuSanJuan. Mira como esta quedando:

menusanjuan.com/{slug}

Si queres entrar a editar algo o ver pedidos, te paso el codigo de nuevo:

Email: {email}
Codigo: {codigo}

Cualquier cosa que necesites avisame!`} />

            <MsgTemplate title="Si preguntan el costo" msg={`Es 100% gratis 🙌

No hay comisiones por pedido, no hay cuota mensual, no hay letra chica.

Los pedidos te llegan directo a tu WhatsApp, los pagos van directo a vos (efectivo, Mercado Pago, transferencia — lo que vos quieras).

Mas adelante vamos a tener opciones premium para quienes quieran funciones extra (analiticas avanzadas, multiples sucursales, integraciones), pero la base siempre va a ser gratuita.`} />

            <MsgTemplate title="Si dicen que ya estan en PedidosYa" msg={`Perfecto! MenuSanJuan no reemplaza PedidosYa — es un complemento.

La diferencia principal es que con nosotros:
• 0% comision (PedidosYa cobra 20-30%)
• Los pedidos llegan a TU WhatsApp
• Vos controlas todo: menu, precios, horarios
• Los datos del cliente son tuyos

Muchos restaurantes lo usan para pedidos directos + PedidosYa para delivery. Asi diversifican y no dependen de una sola plataforma.

¿Queres que te pase tu link para que veas como quedo?`} />

            <MsgTemplate title="Para pedir actualizacion del menu" msg={`Hola! Te escribo para actualizar tu menu en MenuSanJuan.

Si tenes la carta actualizada con los precios de hoy, mandamela (foto, PDF o link) y la cargamos nosotros sin que tengas que hacer nada.

Tu pagina esta en:
menusanjuan.com/{slug}

Cualquier cosa estamos!`} />
          </div>
        </Section>

        {/* Tools available */}
        <Section title="Herramientas del Admin" emoji="🛠️" number={8}>
          <div className="grid grid-cols-2 gap-3">
            <ToolCard title="Tablero (Kanban)" desc="Vista principal de onboarding. 5 columnas, drag-and-drop, modal de detalle con todas las acciones." />
            <ToolCard title="Modal del restaurante" desc="3 tabs: Info (datos + ubicacion + horarios), Menu (CRUD completo + opciones), Dueno (asignar email, activar)." />
            <ToolCard title="Editor de menu" desc="Mismo editor que usan los duenos. Categorias, items, subir imagenes/videos, opciones (gustos, extras)." />
            <ToolCard title="LocationPicker" desc="Mapa de Google con buscador para ubicar el restaurante. Guarda coordenadas para QR de pedidos." />
            <ToolCard title="Pedidos Kanban" desc="Pantalla full screen con los pedidos del restaurante. Drag-and-drop entre estados. Se abre desde el modal." />
            <ToolCard title="Reset de codigo" desc="Generar un codigo nuevo si el dueno perdio el suyo. Funciona tambien para cuentas ya activadas." />
            <ToolCard title="Asignar dueno por email" desc="Si el dueno tiene su propio email, podes asignarlo desde el modal. Cuando se registre, se vincula solo." />
            <ToolCard title="Notas con imagenes" desc="Cada tarjeta del Tablero tiene notas. Podes pegar screenshots, escribir comentarios, mantener historial." />
          </div>
        </Section>

        {/* Daily Routine */}
        <Section title="Rutina Diaria Sugerida" emoji="⏰" number={9}>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["9:00 - 10:00", "Revisar Tablero — ver respuestas en 'En charla', mover a 'Onboardeado' los que ya entraron"],
                  ["10:00 - 11:30", "Activar 5-10 restaurantes nuevos en 'Cola de contacto' y enviar WhatsApps"],
                  ["11:30 - 12:30", "Buscar nuevos restaurantes (IG, Google Maps) y crearlos en el admin"],
                  ["14:00 - 15:00", "Mejorar restaurantes en 'Falta info': agregar fotos, direcciones, ubicaciones"],
                  ["15:00 - 16:00", "Follow-ups en 'En charla' (3+ dias sin respuesta)"],
                  ["16:00 - 17:00", "Atender consultas + actualizar menus de restaurantes activos"],
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

        {/* Metrics */}
        <Section title="Metas" emoji="📊" number={10}>
          <div className="space-y-3">
            <Goal label="Esta semana" value="10 restaurantes onboardeados" desc="Activar y hacer que el dueno entre y configure su contrasena." />
            <Goal label="Este mes" value="30 restaurantes activos" desc="Con duenos reales recibiendo pedidos por la plataforma." />
            <Goal label="3 meses" value="100+ restaurantes activos" desc="Posicion dominante en San Juan. Momento de empezar a pensar en planes premium." />
          </div>
        </Section>

        {/* Quick Links */}
        <Section title="Links Utiles" emoji="🔗" number={0}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Admin (Tablero)", href: "https://admin.menusanjuan.com" },
              { label: "Guia tecnica", href: "/admin/guia" },
              { label: "Marketplace publico", href: "/" },
              { label: "Login del restaurante", href: "/restaurante/login" },
              { label: "Pagina marketing", href: "/para-restaurantes" },
              { label: "Crear cuenta nueva", href: "/restaurante/register" },
            ].map((l) => (
              <a key={l.href} href={l.href} target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary transition-all">
                {l.label}
              </a>
            ))}
          </div>
        </Section>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">MenuSanJuan — Playbook de Ventas</p>
          <p className="text-xs text-slate-300 mt-1">Vamos a dominar San Juan</p>
        </div>
      </div>
    </div>
  );
}

// ─── Components ───

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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <div className="text-2xl font-extrabold text-primary">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function KanbanStage({ color, name, desc }: { color: string; name: string; desc: string }) {
  const colors: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <h4 className="text-sm font-bold mb-0.5">{name}</h4>
      <p className="text-xs opacity-80">{desc}</p>
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
          className="text-xs font-medium text-primary hover:underline">{copied ? "Copiado" : "Copiar"}</button>
      </div>
      <pre className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap bg-white font-sans leading-relaxed">{msg}</pre>
    </div>
  );
}

function PriorityTarget({ level, title, desc }: { level: "alta" | "media" | "baja"; title: string; desc: string }) {
  const colors = { alta: "border-emerald-200 bg-emerald-50", media: "border-blue-200 bg-blue-50", baja: "border-slate-200 bg-slate-50" };
  const labels = { alta: "Prioridad Alta", media: "Prioridad Media", baja: "Prioridad Baja" };
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

function ToolCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{desc}</p>
    </div>
  );
}

function Goal({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <h4 className="text-base font-bold text-slate-900 mt-0.5">{value}</h4>
      <p className="text-xs text-slate-600 mt-1">{desc}</p>
    </div>
  );
}
