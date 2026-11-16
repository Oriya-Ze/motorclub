import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Wrench } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import BusinessCard from "@/components/BusinessCard";
import CreateServiceDialog from "@/components/CreateServiceDialog";
import EmptyState from "@/components/EmptyState";
import ServicesSearchBar from "@/components/ServicesSearchBar";
import { Button } from "@/components/ui/Button";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { BUSINESS_CATEGORIES } from "@/lib/businessProfile";
import { cn } from "@/lib/utils";

export default function ServicesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isBusiness = user?.account_type === "business";
  const [showCreate, setShowCreate] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  const handleDebouncedSearch = useCallback((value: string) => {
    setDebouncedSearch(value);
  }, []);

  const queryKey = useMemo(() => ["services", category, debouncedSearch], [category, debouncedSearch]);

  const { data, isPending, isFetching, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      api.getServices({
        businessType: category || undefined,
        q: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const services = data ?? [];

  if (isPending && services.length === 0) return <ListPageSkeleton rows={3} />;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display tracking-wide">{t("services")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("servicesSubtitle")}</p>
        </div>
        {isBusiness && (
          <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" aria-hidden />
            {t("businessSettings.addService")}
          </Button>
        )}
      </div>
      {showCreate && <CreateServiceDialog onClose={() => setShowCreate(false)} />}

      <ServicesSearchBar onDebouncedChange={handleDebouncedSearch} />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
            !category ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          {t("workshops.allSpecialties")}
        </button>
        {BUSINESS_CATEGORIES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setCategory(type)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
              category === type ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {t(`businessCategories.${type}`)}
          </button>
        ))}
      </div>

      {isError ? (
        <EmptyState
          icon={Wrench}
          title={t("servicesLoadError")}
          description={error instanceof Error ? error.message : t("tryAgainLater")}
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={debouncedSearch || category ? t("servicesNoSearchResults") : t("noServices")}
          description={debouncedSearch || category ? t("servicesSearchEmpty") : t("servicesEmptyCta")}
          action={
            !debouncedSearch && !category ? (
              <Link to="/settings">
                <Button variant="outline" size="sm">{t("businessUpgrade")}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("grid gap-4 sm:grid-cols-2 transition-opacity", isFetching && "opacity-60")}>
          {services.map((service) => (
            <BusinessCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
