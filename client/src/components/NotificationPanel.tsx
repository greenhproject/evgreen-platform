import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Bell, Zap, Calendar, AlertTriangle, Gift, Info, CheckCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Notification {
  id: number;
  type: "CHARGING" | "RESERVATION" | "PROMO" | "SYSTEM" | "ALERT";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

// Datos de ejemplo mientras no hay notificaciones reales
const sampleNotifications: Notification[] = [
  {
    id: 1,
    type: "CHARGING",
    title: "Carga completada",
    message: "Tu sesión de carga en EVGreen Mosquera ha finalizado. Total: 25.4 kWh",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // hace 30 min
    actionUrl: "/history"
  },
  {
    id: 2,
    type: "PROMO",
    title: "¡20% de descuento!",
    message: "Aprovecha el descuento especial en cargas nocturnas de 10pm a 6am",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // hace 2 horas
  },
  {
    id: 3,
    type: "RESERVATION",
    title: "Recordatorio de reserva",
    message: "Tu reserva en Estación Centro está programada para mañana a las 9:00 AM",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // hace 5 horas
    actionUrl: "/reservations"
  },
  {
    id: 4,
    type: "SYSTEM",
    title: "Bienvenido a EVGreen",
    message: "Gracias por unirte. Explora las estaciones de carga cerca de ti.",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // hace 1 día
    actionUrl: "/map"
  }
];

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "CHARGING":
      return <Zap className="w-4 h-4 text-primary" />;
    case "RESERVATION":
      return <Calendar className="w-4 h-4 text-blue-400" />;
    case "PROMO":
      return <Gift className="w-4 h-4 text-yellow-400" />;
    case "ALERT":
      return <AlertTriangle className="w-4 h-4 text-orange-400" />;
    case "SYSTEM":
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
};

interface NotificationPanelProps {
  buttonClassName?: string;
}

export function NotificationPanel({ buttonClassName }: NotificationPanelProps = {}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(sampleNotifications);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
      setOpen(false);
    }
  };

  const handleDismiss = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`rounded-full relative ${buttonClassName || ''}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 sm:w-96 p-0" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary hover:text-primary"
              onClick={handleMarkAllAsRead}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors relative group ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium line-clamp-1 ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDismiss(e, notification.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLocation("/settings/notifications");
              setOpen(false);
            }}
          >
            Configurar notificaciones
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
