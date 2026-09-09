import { useMutation } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const CATEGORIES = ["vehicles", "spareParts", "accessories", "other"] as const;

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateProductModal({ open, onClose, onCreated }: CreateProductModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("other");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const imageUpload = useImageCropUpload({
    purpose: "product",
    onUploaded: (result) => setImageUrls((prev) => [...prev, result.reference]),
    onError: (err) => toast.error(err.message),
  });

  const createProduct = useMutation({
    mutationFn: () =>
      api.createProduct({
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        category,
        image_urls: imageUrls.length ? imageUrls : undefined,
      }),
    onSuccess: () => {
      toast.success(t("businessSettings.productCreated"));
      setName("");
      setDescription("");
      setPrice("");
      setCategory("other");
      setImageUrls([]);
      onCreated();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  const valid = name.trim().length >= 2 && Number(price) > 0;

  return (
    <>
      {imageUpload.cropModal}
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-glow">
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-card/95 backdrop-blur">
            <h2 className="text-lg font-bold">{t("businessSettings.addProduct")}</h2>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            className="p-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) createProduct.mutate();
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessSettings.productName")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("businessSettings.productName")} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessSettings.productPrice")}</label>
              <Input
                type="number"
                min="1"
                step="1"
                dir="ltr"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="₪"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessSettings.productCategory")}</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      category === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {t(`categories.${cat}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessSettings.productDescription")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("businessSettings.productDescriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessSettings.productImages")}</label>
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url, i) => (
                  <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {imageUrls.length < 4 && (
                  <label className="w-20 h-20 rounded-lg border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40 transition-colors">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={imageUpload.uploading}
                      onChange={(e) => imageUpload.handleSelect(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!valid || createProduct.isPending}>
              {createProduct.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("businessSettings.publishing")}
                </>
              ) : (
                t("businessSettings.publishProduct")
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
