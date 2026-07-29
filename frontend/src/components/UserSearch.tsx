import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function UserSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["user-search", debouncedQuery],
    queryFn: () => api.searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (userId: string) => {
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
    navigate(`/profile/${userId}`);
  };

  const showDropdown = open && debouncedQuery.length >= 1;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md w-full">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("searchUsers")}
          className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-background/50 ps-9 pe-9 py-2 text-sm",
            "text-foreground placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setOpen(false);
            }}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 w-full z-50 glass-card rounded-xl border border-border/50 shadow-lg overflow-hidden">
          {isFetching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t("noSearchResults")}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-start"
                  >
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
