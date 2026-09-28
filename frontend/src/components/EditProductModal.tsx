import ProductEditor from "@/components/ProductEditor";
import { Product } from "@/lib/api";

interface EditProductModalProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditProductModal({ product, open, onClose, onUpdated }: EditProductModalProps) {
  return <ProductEditor open={open} product={product} onClose={onClose} onSaved={onUpdated} />;
}
