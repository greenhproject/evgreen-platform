import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Bell, Zap, Calendar, AlertTriangle, Gift, Info, CheckCircle, X, Loader2, BellOff, ExternalLink, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { onForegroundMessage } from "@/lib/firebase";
import { openExternalUrl, isExternalUrl } from "@/lib/openExternal";

interface Notification {
  id: number;
  type: "CHARGING" | "RESERVATION" | "PROMO" | "SYSTEM" | "ALERT" | "LOW_BALANCE" | "CHARGE_COMPLETE" | "SUPPORT";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "CHARGING":
    case "CHARGE_COMPLETE":
      return <Zap className="w-4 h-4 text-primary" />;
    case "SUPPORT":
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
  const notifications: Notification[] = (notificationsQuery.data || []).map((n: any) => {
    // Extraer actionUrl del campo data JSON si existe
    let actionUrl = n.actionUrl;
    if (!actionUrl && n.data) {
      try {
        const parsed = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
        actionUrl = parsed?.actionUrl;
      } catch {}
    }
    // Map support-related notifications to SUPPORT type
    let mappedType = n.type as Notification["type"];
    if (n.referenceType === "support_ticket" || n.type === "SYSTEM") {
      try {
        const parsed = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
        if (parsed?.type?.startsWith('support_')) {
          mappedType = "SUPPORT";
          // Auto-set actionUrl for support notifications
          if (!actionUrl && parsed?.ticketId) {
            actionUrl = "/support";
          }
        }
      } catch {}
    }
    return {
      id: n.id,
      type: mappedType,
      title: n.title,
      message: n.message,
      read: n.isRead ?? n.read ?? false,
      createdAt: new Date(n.createdAt),
      actionUrl,
    };
  });

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
      await utils.notifications.list.invalidate();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    
    // Toggle expand/collapse para ver el mensaje completo
    setExpandedId(expandedId === notification.id ? null : notification.id);
  };

  const handleNavigateAction = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      if (isExternalUrl(notification.actionUrl)) {
        openExternalUrl(notification.actionUrl);
      } else {
        setLocation(notification.actionUrl);
      }
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

  // Verificar si un mensaje es largo (se truncaría)
  const isMessageLong = (message: string) => message.length > 80;

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
        <ScrollArea className="h-[350px]">
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
              {notifications.map((notification) => {
                const isExpanded = expandedId === notification.id;
                const longMessage = isMessageLong(notification.message);
                
                return (
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
                          <p className={`text-sm font-medium ${isExpanded ? "" : "line-clamp-2"} ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <span className="w-2 h-2 bg-primary rounded-full mt-1.5" />
                            )}
                          </div>
                        </div>
                        <p className={`text-xs text-muted-foreground mt-0.5 ${isExpanded ? "" : "line-clamp-2"}`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es })}
                          </p>
                          {longMessage && (
                            <button
                              className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(isExpanded ? null : notification.id);
                                if (!notification.read) {
                                  handleMarkAsRead(notification.id);
                                }
                              }}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  <span>Menos</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  <span>Ver más</span>
                                </>
                              )}
                            </button>
                          )}
                          {notification.actionUrl && (
                            <button
                              className="flex items-center gap-0.5 text-[10px] text-primary font-medium hover:text-primary/80"
                              onClick={(e) => handleNavigateAction(e, notification)}
                            >
                              {isExternalUrl(notification.actionUrl) ? (
                                <ExternalLink className="w-3 h-3" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              <span>{notification.actionUrl === '/wallet' ? 'Ir a billetera' : 'Ver'}</span>
                            </button>
                          )}
                        </div>
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
                );
              })}
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
