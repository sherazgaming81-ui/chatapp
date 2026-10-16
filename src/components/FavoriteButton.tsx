"use client";
// Reusable star button — top-right corner of a GIF/sticker.
// Appears on hover (desktop), always visible on touch devices.
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { isFavorite, toggleFavorite, subscribeFavorites, type FavoriteItem } from "@/lib/favorites";

export default function FavoriteButton({
  item,
  size = 16,
}: {
  item: FavoriteItem;
  size?: number;
}) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setFav(isFavorite(item.id));
    return subscribeFavorites(() => setFav(isFavorite(item.id)));
  }, [item.id]);

  return (
    <button
      type="button"
      aria-label={fav ? "Favorite se hatao" : "Favorite me save karo"}
      title={fav ? "Favorite se hatao" : "Favorite me save karo"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(item);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-black/65 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <Star
        size={size}
        className={fav ? "fill-amber-300 text-amber-300" : "text-white"}
      />
    </button>
  );
}
