# Cowork Scraping Guide — PedidosYa → MenuSanJuan

## Your Mission

You are already logged into pedidosya.com.ar and on the San Juan restaurants page. Your job is to extract restaurant data and push it into MenuSanJuan using the MCP tools.

## The Method That Works

**DO NOT try to scrape HTML, read DOM elements, or parse page content.** PedidosYa loads everything via API calls. The data you need is in the **Network traffic**.

### How to get restaurant data:

1. **Navigate to a restaurant page** on PedidosYa (click on any restaurant)
2. **Open DevTools** → Network tab → filter by `menus`
3. **Find the XHR request** to: `GET /v2/niles/partners/{id}/menus?occasion=DELIVERY`
4. **Copy the full JSON response** — this contains ALL the menu data (categories, items, prices, images)
5. **The restaurant's PedidosYa ID** is the `{id}` number in that URL

That's it. One network request per restaurant gives you everything.

### What the menu JSON looks like:
```json
{
  "sections": [
    {
      "name": "Hamburguesas",
      "products": [
        {
          "name": "Hamburguesa clásica",
          "description": "Pan, carne, lechuga, tomate",
          "price": { "finalPrice": 8500 },
          "images": { "urls": ["uuid-here.jpeg"] },
          "tags": { "isMostOrdered": true },
          "enabled": true
        }
      ]
    }
  ]
}
```

### What to do with it:

For each NEW restaurant (not already in our DB):

```
Step 1: create_restaurant
  - name: restaurant name from PedidosYa
  - sourceProfileId: the PedidosYa ID (as string, e.g. "550595")
  - sourceSite: "pedidosya"
  - cuisineType: guess from menu (Comida Rápida, Pizzería, Parrilla, Cafetería, Sushi, Heladería, Empanadas, Pastas, Vegetariano, Postres, General)

Step 2: import_pedidosya_menu
  - restaurant_slug: the slug returned from step 1
  - menu_json: paste the ENTIRE JSON response from the network request
  - This automatically downloads all product images to our R2 CDN

Step 3: set_restaurant_image
  - restaurant_slug: same slug
  - type: "logo"
  - source_url: the restaurant's logo URL from PedidosYa
    Logo URLs look like: https://pedidosya.dhmedia.io/image/pedidosya/restaurants/{uuid}.jpg
    You can find this in the page's img tags or network requests

Step 4: fetch_google_cover
  - restaurant_slug: same slug
  - This searches Google Places and sets a real cover photo

Step 5: activate_restaurant
  - slug: same slug
  - This makes it live on menusanjuan.com with 4.7 stars
```

## About Images

**IMPORTANT:** The MCP handles images automatically:

- `import_pedidosya_menu` → downloads each product image from PedidosYa CDN → uploads to our R2 bucket (`images.menusanjuan.com`) → stores our permanent URL in the DB
- `set_restaurant_image` → downloads logo from PedidosYa → uploads to R2 → updates DB
- `fetch_google_cover` → searches Google Places → downloads photo → uploads to R2 → updates DB

You do NOT need to handle images separately. Just pass the PedidosYa URLs and the MCP does the rest. All images end up on `images.menusanjuan.com` where they never expire.

## PedidosYa IDs We Already Have (SKIP THESE)

```
102144, 115859, 138056, 150511, 151545, 161425, 180356, 237080,
273404, 286932, 293261, 303988, 314747, 327527, 345451, 381552,
394376, 402586, 442288, 503798, 522621, 531067, 531335, 532914,
541326, 541837, 543203, 582090, 592574
```

Use `list_restaurants` to check if a restaurant already exists before creating it.

## How to Find the PedidosYa ID

When you navigate to a restaurant page, look at:
- The URL: `pedidosya.com.ar/restaurantes/san-juan/{restaurant-name}-menu`
- The network request: `GET /v2/niles/partners/{ID}/menus` — the number is the ID
- It may also appear in other API calls on the page

## How to Get the Logo URL

Look in the page source or network requests for an image URL containing:
`pedidosya.dhmedia.io/image/pedidosya/restaurants/`

This is the restaurant's logo. Pass this URL to `set_restaurant_image` with type "logo".

## Tips

- **Closed restaurants** ("cerrado momentáneamente") will have empty `sections: []` — skip them
- **Scroll down** on the restaurant list page to load more restaurants
- **Work one restaurant at a time** — navigate to page, grab network response, use MCP tools, move to next
- **Friday/Saturday 9pm+** is the best time — most restaurants are open so menus have full data
- If `import_pedidosya_menu` fails on some images, that's OK — it falls back to the PedidosYa URL and we can migrate later
