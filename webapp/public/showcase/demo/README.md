# /public/showcase/demo/

Screenshots for the "De la orden al reparto, paso a paso" section on
`/para-restaurantes`. See `docs/demo-screenshot-recipe.md` at the repo root
for the full recipe (URLs, what to capture, filename convention).

Once a file lands in this folder, flip its `ready` flag from `false` to
`true` inside `webapp/src/app/para-restaurantes/page.tsx`'s `DEMO_STEPS`
array. The `<StepImage>` component will start rendering `<img src>` instead
of the placeholder card.
