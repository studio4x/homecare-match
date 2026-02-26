import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, QrCode } from "lucide-react";

type PaymentMethod = "credit_card" | "pix";

type CoursePaymentMethodDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle?: string;
  priceLabel?: string;
  loading?: boolean;
  onSelect: (method: PaymentMethod) => void;
};

const CoursePaymentMethodDialog = ({
  open,
  onOpenChange,
  courseTitle,
  priceLabel,
  loading,
  onSelect,
}: CoursePaymentMethodDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolha a forma de pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {courseTitle && (
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
              <p className="font-semibold">{courseTitle}</p>
              {priceLabel ? <p className="text-xs text-muted-foreground">{priceLabel}</p> : null}
            </div>
          )}
          <div className="grid gap-2">
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => onSelect("credit_card")}
              disabled={!!loading}
            >
              <CreditCard className="h-4 w-4" /> Cartão de Crédito
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => onSelect("pix")}
              disabled={!!loading}
            >
              <QrCode className="h-4 w-4" /> PIX
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Boleto bancário não está disponível. PIX ativo apenas para cursos.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoursePaymentMethodDialog;
