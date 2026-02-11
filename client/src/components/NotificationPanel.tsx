import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Bell, Zap, Calendar, AlertTriangle, Gift, Info, CheckCircle, X, Loader2, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { onForegroundMessage } from "@/lib/firebase";

interface Notification {
  id: number;
  type: "CHARGING" | "RESERVATION" | "PROMO" | "SYSTEM" | "ALERT" | "LOW_BALANCE";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

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
    case "LOW_BALANCE":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
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
  const { isAuthenticated } = useAuth();
  const { isEnabled, isSupported, enableNotifications } = useNotifications();
  
  // Cargar notificaciones de la base de datos
  const notificationsQuery = trpc.notifications.list.useQuery(
    { unreadOnly: false },
    { enabled: isAuthenticated }
  );
  
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();
  const deleteMutation = trpc.notifications.delete.useMutation();
  const utils = trpc.useUtils();

  // Convertir notificaciones de la API al formato local
  const notifications: Notification[] = (notificationsQuery.data || []).map((n: any) => ({
    id: n.id,
    type: n.type as Notification["type"],
    title: n.title,
    message: n.message,
    read: n.isRead ?? n.read ?? false,
    createdAt: new Date(n.createdAt),
    actionUrl: n.actionUrl,
  }));

  const unreadCount = notifications.filter(n => !n.read).length;
  const loading = notificationsQuery.isLoading;

  // Escuchar notificaciones en tiempo real
  useEffect(() => {
    if (!isEnabled) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Refrescar lista de notificaciones cuando llega una nueva
      notificationsQuery.refetch();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isEnabled, notificationsQuery]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsReadMutation.mutateAsync({ id });
      await utils.notifications.list.invalidate();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      // Invalidar y refetch para actualizar la UI inmediatamente
      await utils.notifications.list.invalidate();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
      setOpen(false);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync({ id });
      await utils.notifications.list.invalidate();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleEnableNotifications = async () => {
    await enableNotifications();
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
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {/* Push Notification Banner */}
        {isSupported && !isEnabled && isAuthenticated && (
          <div className="p-3 bg-primary/10 border-b border-border">
            <div className="flex items-center gap-2">
              <BellOff className="w-4 h-4 text-primary" />
              <span className="text-xs text-foreground flex-1">
                Activa las notificaciones push para no perderte nada
              </span>
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs h-7"
                onClick={handleEnableNotifications}
              >
                Activar
              </Button>
            </div>
          </div>
        )}

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
              <p className="text-muted-foreground/70 text-xs mt-1">
                Las alertas de carga y promociones aparecerán aquí
              </p>
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
                      disabled={deleteMutation.isPending}
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
