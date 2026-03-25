# MenuSanJuan — Instrucciones para Subir Restaurantes

## Qué es esto

Vas a leer menús de restaurantes (de PDF, foto, documento, o cualquier fuente) y subirlos a la base de datos de MenuSanJuan usando comandos bash con `curl`. Cada restaurante tiene un perfil + menú organizado por categorías con items y precios.

**IMPORTANTE**: Los restaurantes se crean como **inactivos y sin dueño**. Después de subirlos, el admin los revisa, ajusta, y activa manualmente. Nada se publica automáticamente.

---

## Cómo hacerlo (paso a paso)

### Paso 0: Autenticarte como admin

Antes de cualquier cosa, ejecutá este comando para loguearte:

```bash
curl -c /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@menusanjuan.com", "password": "admin-menusj-2024"}'
```

Esto guarda la sesión. Usá `-b /tmp/menusj-cookies.txt` en todos los comandos siguientes.

---

### Paso 1: Leer el menú

Leé el PDF, imagen, o documento. Extraé:

**Del restaurante:**
- Nombre
- Teléfono / WhatsApp (si no aparece, poné `"0000000000"`)
- Dirección (si aparece)
- Tipo de cocina (elegí de la lista en Paso 2)
- Descripción corta (1-2 oraciones basadas en el menú)

**Del menú:**
- Categorías (secciones: "Hamburguesas", "Bebidas", "Postres", etc.)
- Items dentro de cada categoría (nombre, precio, descripción si tiene)

---

### Paso 2: Crear el restaurante

```bash
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NOMBRE DEL RESTAURANTE",
    "phone": "TELEFONO",
    "address": "DIRECCION",
    "cuisineType": "TIPO DE COCINA",
    "description": "DESCRIPCION CORTA"
  }'
```

**Anotá el `id` de la respuesta** — lo necesitás para el menú.

**Tipos de cocina válidos** (usá exactamente uno):
Comida Rápida, Parrilla, Pizzería, Cafetería, Pastas, Sushi, Heladería, Empanadas, Comida Árabe, Comida Mexicana, Comida China, Vegetariano, Postres, Rotisería, General

---

### Paso 3: Agregar categorías

Para cada sección del menú:

```bash
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/ID_RESTAURANTE/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "category", "name": "NOMBRE", "emoji": "EMOJI"}'
```

**Anotá el `id` de cada categoría.**

**Emojis:**
Hamburguesas 🍔, Lomitos 🥖, Pizzas 🍕, Empanadas 🥟, Pastas 🍝, Carnes 🥩, Pollo 🍗, Ensaladas 🥗, Papas/Guarniciones 🍟, Postres 🍰, Bebidas 🥤, Alcohol 🍷, Café ☕, Helados 🍦, Combos ⭐, Sushi 🍣, Desayunos 🥐, Minutas 🍽️, Milanesas 🍗, Platos Calientes 🍲, Pescados 🐟

---

### Paso 4: Agregar items

Para cada item del menú:

```bash
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/ID_RESTAURANTE/menu \
  -H "Content-Type: application/json" \
  -d '{
    "type": "item",
    "categoryId": "ID_CATEGORIA",
    "name": "NOMBRE",
    "price": PRECIO,
    "description": "DESCRIPCION OPCIONAL"
  }'
```

---

## Reglas

1. **Precio**: Número sin `$`. Si ves "$5.500" → poné `5500`
2. **Teléfono**: Si no aparece, usá `"0000000000"`
3. **Categorías**: Si el menú no tiene secciones claras, crealas vos
4. **Descripción**: Solo si el menú la tiene. No inventes.
5. **Badge**: Solo si el menú marca algo como destacado. Valores: `"Popular"`, `"Nuevo"`, `"Especial"`
6. **Items sin precio**: `price: 0` y descripción `"Consultar precio"`
7. **El restaurante se crea INACTIVO** — el admin lo activa después de revisar

---

## Ejemplo Completo

```bash
# Login
curl -c /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@menusanjuan.com", "password": "admin-menusj-2024"}'

# Crear restaurante
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "El Rincón Criollo",
    "phone": "2644001234",
    "address": "Calle San Martín 500, Capital",
    "cuisineType": "Parrilla",
    "description": "Comida criolla y parrilla en el centro de San Juan."
  }'
# → Anotá el id, ej: "abc123"

# Categoría: Parrilla
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "category", "name": "Parrilla", "emoji": "🥩"}'
# → Anotá id, ej: "cat1"

# Categoría: Bebidas
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "category", "name": "Bebidas", "emoji": "🥤"}'
# → Anotá id, ej: "cat2"

# Items de Parrilla
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "item", "categoryId": "cat1", "name": "Asado de Tira", "price": 8500, "description": "Cocción lenta a las brasas."}'

curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "item", "categoryId": "cat1", "name": "Vacío", "price": 7800}'

curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "item", "categoryId": "cat1", "name": "Entraña", "price": 8200}'

# Items de Bebidas
curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "item", "categoryId": "cat2", "name": "Vino Tinto (botella)", "price": 5500}'

curl -b /tmp/menusj-cookies.txt -X POST https://menusanjuan.com/api/admin/restaurants/abc123/menu \
  -H "Content-Type: application/json" \
  -d '{"type": "item", "categoryId": "cat2", "name": "Gaseosa 1.5L", "price": 2000}'
```

**Después**: Admin revisa en `menusanjuan.com/admin?login` → click en el restaurante → ajusta → activa.

---

## Qué pasa después

1. Restaurante creado como **INACTIVO** (no aparece en el sitio público)
2. Admin va a `menusanjuan.com/admin?login`
3. Click en el restaurante → revisa nombre, menú, precios
4. Ajusta lo que haga falta
5. Toggle **"Activo"** → el restaurante aparece en el marketplace
6. Opcionalmente asigna un dueño por email en la pestaña "Dueño"

---

## Esquema (referencia rápida)

**Restaurante**: name (obligatorio), phone (obligatorio), address, cuisineType, description, slug (auto)
**Categoría**: name (obligatorio), emoji (opcional), type="category"
**Item**: name (obligatorio), price (obligatorio, número), description, badge, categoryId, type="item"
