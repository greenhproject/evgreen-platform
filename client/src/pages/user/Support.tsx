import { useState } from "react";
import { motion } from "framer-motion";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageCircle,
  Phone,
  Mail,
  HelpCircle,
  ChevronRight,
  Send,
  Zap,
  CreditCard,
  MapPin
} from "lucide-react";
import { toast } from "sonner";

const FAQ_ITEMS = [
  {
    question: "¿Cómo inicio una carga?",
    answer: "Puedes iniciar una carga escaneando el código QR del cargador o seleccionándolo desde el mapa.",
  },
  {
    question: "¿Cómo recargo mi billetera?",
    answer: "Ve a la sección Billetera, selecciona un monto y completa el pago con tu tarjeta de crédito.",
  },
  {
    question: "¿Qué hago si el cargador no funciona?",
    answer: "Reporta el problema desde esta sección o llama a nuestra línea de soporte 24/7.",
  },
  {
    question: "¿Cómo cancelo una reserva?",
    answer: "Ve a Mis Reservas y presiona el botón de cancelar. Recuerda que puede aplicar penalización.",
  },
];

export default function UserSupport() {
  const [message, setMessage] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSendMessage = () => {
    if (!message.trim()) {
      toast.error("Escribe un mensaje");
      return;
    }
    toast.success("Mensaje enviado. Te responderemos pronto.");
    setMessage("");
  };

  const contactOptions = [
    {
      icon: MessageCircle,
      label: "Chat en vivo",
      description: "Respuesta inmediata",
      action: () => toast.info("Chat próximamente disponible"),
    },
    {
      icon: Phone,
      label: "Llamar soporte",
      description: "24/7 disponible",
      action: () => window.open("tel:+573001234567"),
    },
    {
      icon: Mail,
      label: "Enviar email",
      description: "soporte@greenev.co",
      action: () => window.open("mailto:soporte@greenev.co"),
    },
  ];

  return (
    <UserLayout title="Soporte" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Opciones de contacto */}
        <div className="grid grid-cols-3 gap-3">
          {contactOptions.map((option, index) => (
            <motion.div
              key={option.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="p-4 text-center cursor-pointer card-interactive"
                onClick={option.action}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <option.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Formulario de mensaje */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Envíanos un mensaje</h3>
            <Textarea
              placeholder="Describe tu problema o pregunta..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] mb-4"
            />
            <Button
              className="w-full gradient-primary text-white"
              onClick={handleSendMessage}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar mensaje
            </Button>
          </Card>
        </motion.div>

        {/* Preguntas frecuentes */}
        <div>
          <h3 className="font-semibold mb-4">Preguntas frecuentes</h3>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <Card
                  className="overflow-hidden cursor-pointer"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-primary" />
                      <span className="font-medium">{item.question}</span>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-muted-foreground transition-transform ${
                        expandedFaq === index ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                  {expandedFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 text-muted-foreground text-sm"
                    >
                      {item.answer}
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Reportar problema con cargador */}
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-orange-900">¿Problema con un cargador?</h4>
              <p className="text-sm text-orange-700 mb-3">
                Si tienes un problema durante tu carga, repórtalo aquí para asistencia inmediata.
              </p>
              <Button variant="outline" className="border-orange-300 text-orange-700">
                Reportar problema
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </UserLayout>
  );
}
