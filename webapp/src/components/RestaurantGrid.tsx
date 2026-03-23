"use client";

import { useState, useMemo, useEffect } from "react";
import { DEMO_RESTAURANTS } from "@/data/restaurants";
import type { Restaurant } from "@/data/restaurants";
import { RestaurantCard } from "./RestaurantCard";
import { CuisineFilter } from "./CuisineFilter";
import { SearchBar } from "./SearchBar";

export function RestaurantGrid() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(DEMO_RESTAURANTS);
  const [cuisine, setCuisine] = useState("all");
  const [search, setSearch] = useState("");

  // Fetch real restaurants from API (merges DB + demo)
  useEffect(() => {
    fetch("/api/restaurants")
      .then((r) => r.json())
      .then((data) => setRestaurants(data))
      .catch(() => {}); // fallback to demo data on error
  }, []);

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesCuisine = cuisine === "all" || r.cuisineType === cuisine;
      const matchesSearch =
        search === "" ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.cuisineType.toLowerCase().includes(search.toLowerCase()) ||
        r.address.toLowerCase().includes(search.toLowerCase());
      return matchesCuisine && matchesSearch;
    });
  }, [restaurants, cuisine, search]);

  return (
    <section id="restaurantes" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
            Restaurantes
          </h2>
          <p className="mt-2 text-text-secondary">
            {filtered.length} restaurante{filtered.length !== 1 ? "s" : ""}{" "}
            {cuisine !== "all" ? `de ${cuisine}` : "disponibles"}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <SearchBar value={search} onChange={setSearch} />
          <CuisineFilter selected={cuisine} onChange={setCuisine} />
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((restaurant, i) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-surface p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-3xl">
              🔍
            </div>
            <h3 className="text-lg font-bold text-text mb-2">
              No encontramos restaurantes
            </h3>
            <p className="text-sm text-text-secondary">
              Probá con otra búsqueda o cambiá los filtros.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
