import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Camera, Loader2, Check, CreditCard, Copy } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function PersonalInfo() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    birthDate: "",
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar datos del usuario al montar
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: (user as any).phone || "",
        address: (user as any).address || "",
        city: (user as any).city || "",
        birthDate: (user as any).birthDate || "",
      });
      if ((user as any).avatarUrl) {
        setAvatarPreview((user as any).avatarUrl);
      }
    }
  }, [user]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Información actualizada correctamente", {
        icon: <Check className="w-4 h-4 text-green-500" />,
      });
      setHasChanges(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Error al guardar los cambios");
    },
  });

  const uploadAvatarMutation = trpc.auth.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarPreview(data.avatarUrl);
      setIsUploading(false);
      const savedKB = ((data.originalSize - data.compressedSize) / 1024).toFixed(0);
      toast.success(`Foto actualizada (${savedKB}KB ahorrados)`);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error(err.message || "Error al subir la foto");
    },
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    const { email, ...profileData } = formData;
    updateProfileMutation.mutate(profileData);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Solo se permiten imágenes JPEG, PNG o WebP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }

    // Mostrar preview inmediato
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir al servidor
    setIsUploading(true);
    const base64Reader = new FileReader();
    base64Reader.onload = () => {
      const base64 = (base64Reader.result as string).split(",")[1];
      uploadAvatarMutation.mutate({
        fileName: file.name,
        fileBase64: base64,
        contentType: file.type,
      });
    };
    base64Reader.readAsDataURL(file);

    // Reset input para permitir subir la misma imagen
    e.target.value = "";
  };

  const getInitials = () => {
    const name = formData.name || user?.name || "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase() || "U";
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center gap-4 p-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setLocation("/profile")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Información Personal</h1>
          </div>
        </div>

        <div className="p-4 space-y-4 pb-8">
          {/* Avatar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Foto de perfil"
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary/30"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                      {getInitials()}
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    "Cambiar foto"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ID Tag (NFC) - Solo lectura */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                ID Tag (NFC)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-mono text-lg font-bold tracking-wider text-primary">
                    {(user as any)?.idTag || "Generando..."}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Identificador único para tarjetas NFC. No puede ser modificado.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    const idTag = (user as any)?.idTag;
                    if (idTag) {
                      navigator.clipboard.writeText(idTag);
                      toast.success("ID Tag copiado al portapapeles");
                    }
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Datos básicos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Tu nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={handleChange}
                    className="pl-10"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Importante para recibir promociones de cumpleaños
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 opacity-60"
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  El email está vinculado a tu cuenta y no puede cambiarse
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+57 300 123 4567"
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ubicación */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Calle, número, barrio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Tu ciudad"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full gradient-primary"
            onClick={handleSave}
            disabled={updateProfileMutation.isPending || !hasChanges}
          >
            {updateProfileMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : hasChanges ? (
              "Guardar cambios"
            ) : (
              "Sin cambios"
            )}
          </Button>
        </div>
      </div>
    </UserLayout>
  );
}
