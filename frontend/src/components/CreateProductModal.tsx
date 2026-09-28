import ProductEditor from "@/components/ProductEditor";

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateProductModal({ open, onClose, onCreated }: CreateProductModalProps) {
  return <ProductEditor open={open} onClose={onClose} onSaved={onCreated} />;
}
