import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Tag, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";
import { formatIls } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Vehicle, type VehicleSaleListing } from "@/lib/api";
import { digitsOnly } from "@/lib/numericInput";

const PRICE_DIGITS = 9;

/**
 * Selling a vehicle from its card. The shop lists the card itself (name, photos, details) and links back here,
 * so the owner sets only a price and an optional note. Visitors see the price and can message the seller.
 */
export default function VehicleSaleSection({ vehicle, isOwner }: { vehicle: Vehicle; isOwner: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesPanel = useMessagesPanelOptional();
  const id = useId();
  const listing = vehicle.sale_listing ?? null;
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [priceError, setPriceError] = useState(false);

  const setListing = (next: VehicleSaleListing | null) => {
    queryClient.setQueryData<Vehicle>(["vehicle", vehicle.id], (prev) => (prev ? { ...prev, sale_listing: next } : prev));
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["my-products"] });
    queryClient.invalidateQueries({ queryKey: ["business-products"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = { price: Number(price), description: note.trim() || null };
      return listing ? api.updateProduct(listing.id, body) : api.listVehicleForSale({ vehicle_id: vehicle.id, ...body });
    },
    onSuccess: (product) => {
      toast.success(listing ? t("garage.sale.updated") : t("garage.sale.published"));
      setListing({
        id: product.id,
        price: product.price,
        description: product.description,
        listing_status: product.listing_status ?? "published",
      });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteProduct(listing!.id),
    onSuccess: () => {
      toast.success(t("garage.sale.removed"));
      setListing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const contactSeller = useMutation({
    mutationFn: () => api.startConversation(vehicle.user_id),
    onSuccess: (conv) => messagesPanel?.openMessages(conv.id),
    onError: (err: Error) => toast.error(err.message),
  });

  const openForm = () => {
    setPrice(listing ? String(Math.round(listing.price)) : "");
    setNote(listing?.description ?? "");
    setPriceError(false);
    setEditing(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(price)) {
      setPriceError(true);
      return;
    }
    save.mutate();
  };

  if (!listing && !isOwner) return null;

  if (editing) {
    return (
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4" noValidate>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Tag className="h-4 w-4 text-primary" aria-hidden />
          {listing ? t("garage.sale.editPrice") : t("garage.sale.sell")}
        </p>
        {!listing && <p className="text-xs text-muted-foreground">{t("garage.sale.hint")}</p>}
        <div className="space-y-1">
          <label htmlFor={`${id}-price`} className="text-sm font-medium">{t("garage.sale.price")}</label>
          <Input
            id={`${id}-price`}
            inputMode="numeric"
            dir="ltr"
            value={price}
            onChange={(e) => {
              setPrice(digitsOnly(e.target.value, PRICE_DIGITS));
              setPriceError(false);
            }}
            aria-invalid={priceError}
            aria-describedby={priceError ? `${id}-price-error` : undefined}
            autoFocus
          />
          {priceError && (
            <p id={`${id}-price-error`} role="alert" className="text-xs text-destructive">{t("garage.sale.priceRequired")}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">{t("garage.sale.note")}</label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={4000}
            rows={3}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {listing ? t("garage.sale.save") : t("garage.sale.publish")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  if (!listing) {
    return (
      <Button size="sm" variant="outline" onClick={openForm} className="border-primary/40 text-primary">
        <Tag className="w-4 h-4 me-1" />
        {t("garage.sale.sell")}
      </Button>
    );
  }

  const live = listing.listing_status === "published";
  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Tag className="h-4 w-4" aria-hidden />
          {t("garage.sale.forSale")}
        </p>
        <p className="text-xl font-bold">{formatIls(listing.price)}</p>
      </div>
      {listing.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{listing.description}</p>}
      {isOwner && !live && <p className="text-sm text-destructive" role="status">{t("garage.sale.hiddenByStaff")}</p>}
      <div className="flex flex-wrap gap-2">
        {isOwner ? (
          <>
            {live && (
              <Button size="sm" variant="outline" onClick={openForm}>
                <Pencil className="w-4 h-4 me-1" />
                {t("garage.sale.editPrice")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(t("garage.sale.confirmRemove"))) remove.mutate();
              }}
            >
              <Trash2 className="w-4 h-4 me-1" />
              {t("garage.sale.remove")}
            </Button>
          </>
        ) : user ? (
          <Button size="sm" onClick={() => contactSeller.mutate()} disabled={contactSeller.isPending}>
            <Mail className="w-4 h-4 me-1" />
            {t("garage.sale.contactSeller")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
