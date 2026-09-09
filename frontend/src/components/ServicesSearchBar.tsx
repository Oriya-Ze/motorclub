import { Search } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/Input";

interface ServicesSearchBarProps {
  onDebouncedChange: (value: string) => void;
}

const ServicesSearchBar = memo(function ServicesSearchBar({ onDebouncedChange }: ServicesSearchBarProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onDebouncedChange(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, onDebouncedChange]);

  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("workshops.search")}
        className="ps-9"
        autoComplete="off"
      />
    </div>
  );
});

export default ServicesSearchBar;
