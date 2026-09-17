/**
 * Componente de Configuración de Facturación Electrónica Multi-Proveedor
 * Compatible con Alegra, Siigo Nube y World Office Cloud
 * Modos: 'tenant' (portal de organización SaaS) o 'admin' (plataforma global)
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Building,
  KeyRound,
  Mail,
  ShieldCheck,
  Send,
  Database,
  ExternalLink,
} from "lucide-react";

interface Props {
  mode?: "tenant" | "admin";
}

export default function ElectronicBillingConfigCard({ mode = "tenant" }: Props) {
  const utils = trpc.useUtils();

  // Queries según modo
  const tenantConfigQuery = (trpc.organizations as any).getMyElectronicBillingConfig.useQuery(undefined, {
    enabled: mode === "tenant",
  });
  const adminConfigQuery = (trpc.settings as any).billingGetPlatformConfig.useQuery(undefined, {
    enabled: mode === "admin",
  });

  const config = mode === "tenant" ? tenantConfigQuery.data : adminConfigQuery.data;
  const isLoading = mode === "tenant" ? tenantConfigQuery.isLoading : adminConfigQuery.isLoading;

  // Mutaciones
  const saveTenantMutation = (trpc.organizations as any).saveMyElectronicBillingConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración de facturación guardada exitosamente");
      (utils.organizations as any).getMyElectronicBillingConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error al guardar: ${err.message}`),
  });

  const saveAdminMutation = (trpc.settings as any).billingSavePlatformConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración global de facturación guardada exitosamente");
      (utils.settings as any).billingGetPlatformConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error al guardar: ${err.message}`),
  });

  const testTenantMutation = (trpc.organizations as any).testMyElectronicBillingConnection.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(`Conexión exitosa: ${data.companyName || "Proveedor conectado"}`);
      } else {
        toast.error(`Error de conexión: ${data.error}`);
      }
      (utils.organizations as any).getMyElectronicBillingConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error en la prueba: ${err.message}`),
  });

  const testAdminMutation = (trpc.settings as any).billingTestPlatformConnection.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(`Conexión exitosa: ${data.companyName || "Proveedor conectado"}`);
      } else {
        toast.error(`Error de conexión: ${data.error}`);
      }
      (utils.settings as any).billingGetPlatformConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error en la prueba: ${err.message}`),
  });

  // Estado del formulario
  const [provider, setProvider] = useState<"alegra" | "siigo" | "world_office">("alegra");
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("production");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [resolutionNumber, setResolutionNumber] = useState("");

  // Alegra
  const [alegraEmail, setAlegraEmail] = useState("");
  const [alegraToken, setAlegraToken] = useState("");
  const [alegraTokenSaved, setAlegraTokenSaved] = useState(false);
  const [alegraDefaultItemId, setAlegraDefaultItemId] = useState("");
  const [alegraDefaultTaxId, setAlegraDefaultTaxId] = useState("");
  const [alegraPaymentMethodId, setAlegraPaymentMethodId] = useState("");
  const [alegraPaymentAccountId, setAlegraPaymentAccountId] = useState("");
  const [alegraUseElectronicStamp, setAlegraUseElectronicStamp] = useState(true);

  // Siigo
  const [siigoUsername, setSiigoUsername] = useState("");
  const [siigoAccessKey, setSiigoAccessKey] = useState("");
  const [siigoAccessKeySaved, setSiigoAccessKeySaved] = useState(false);
  const [siigoPartnerId, setSiigoPartnerId] = useState("EVGreenSaaS");
  const [siigoDocumentId, setSiigoDocumentId] = useState("");
  const [siigoSellerId, setSiigoSellerId] = useState("");
  const [siigoPaymentTypeId, setSiigoPaymentTypeId] = useState("");
  const [siigoProductCode, setSiigoProductCode] = useState("EV-KWH-01");
  const [siigoTaxId, setSiigoTaxId] = useState("");
  const [siigoStamp, setSiigoStamp] = useState(true);
  const [siigoMail, setSiigoMail] = useState(true);

  // World Office
  const [worldOfficeToken, setWorldOfficeToken] = useState("");
  const [worldOfficeTokenSaved, setWorldOfficeTokenSaved] = useState(false);
  const [worldOfficeCompanyId, setWorldOfficeCompanyId] = useState("1");
  const [worldOfficeDocumentTypeId, setWorldOfficeDocumentTypeId] = useState("1");
  const [worldOfficePrefixId, setWorldOfficePrefixId] = useState("");
  const [worldOfficePaymentMethodId, setWorldOfficePaymentMethodId] = useState("1");
  const [worldOfficeItemId, setWorldOfficeItemId] = useState("1");
  const [worldOfficeTaxId, setWorldOfficeTaxId] = useState("");

  // Catálogos cargados
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogTaxes, setCatalogTaxes] = useState<any[]>([]);
  const [catalogPaymentMethods, setCatalogPaymentMethods] = useState<any[]>([]);
  const [catalogDocTypes, setCatalogDocTypes] = useState<any[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // Sincronizar estado inicial desde DB
  useEffect(() => {
    if (config) {
      setProvider((config.provider as any) || "alegra");
      setEnabled(!!config.enabled);
      setEnvironment((config.environment as any) || "production");
      setAutoInvoice(config.autoInvoice !== false);
      setAutoSendEmail(config.autoSendEmail !== false);
      setResolutionNumber(config.resolutionNumber || "");

      // Alegra
      setAlegraEmail(config.alegraEmail || "");
      setAlegraTokenSaved(!!config.alegraToken);
      setAlegraToken(config.alegraToken || "");
      setAlegraDefaultItemId(config.alegraDefaultItemId || "");
      setAlegraDefaultTaxId(config.alegraDefaultTaxId || "");
      setAlegraPaymentMethodId(config.alegraPaymentMethodId || "");
      setAlegraPaymentAccountId(config.alegraPaymentAccountId || "");
      setAlegraUseElectronicStamp(config.alegraUseElectronicStamp !== false);

      // Siigo
      setSiigoUsername(config.siigoUsername || "");
      setSiigoAccessKeySaved(!!config.siigoAccessKey);
      setSiigoAccessKey(config.siigoAccessKey || "");
      setSiigoPartnerId(config.siigoPartnerId || "EVGreenSaaS");
      setSiigoDocumentId(config.siigoDocumentId || "");
      setSiigoSellerId(config.siigoSellerId || "");
      setSiigoPaymentTypeId(config.siigoPaymentTypeId || "");
      setSiigoProductCode(config.siigoProductCode || "EV-KWH-01");
      setSiigoTaxId(config.siigoTaxId || "");
      setSiigoStamp(config.siigoStamp !== false);
      setSiigoMail(config.siigoMail !== false);

      // World Office
      setWorldOfficeTokenSaved(!!config.worldOfficeToken);
      setWorldOfficeToken(config.worldOfficeToken || "");
      setWorldOfficeCompanyId(config.worldOfficeCompanyId || "1");
      setWorldOfficeDocumentTypeId(config.worldOfficeDocumentTypeId || "1");
      setWorldOfficePrefixId(config.worldOfficePrefixId || "");
      setWorldOfficePaymentMethodId(config.worldOfficePaymentMethodId || "1");
      setWorldOfficeItemId(config.worldOfficeItemId || "1");
      setWorldOfficeTaxId(config.worldOfficeTaxId || "");
    }
  }, [config]);

  // Cargar catálogos dinámicamente según el proveedor activo
  const handleLoadCatalogs = async () => {
    setLoadingCatalogs(true);
    try {
      let data: any;
      if (mode === "tenant") {
        data = await (utils.organizations as any).listMyBillingCatalogs.fetch({ provider });
      } else {
        data = await (utils.settings as any).billingListPlatformCatalogs.fetch({ provider });
      }
      if (data) {
        setCatalogItems(data.items || []);
        setCatalogTaxes(data.taxes || []);
        setCatalogPaymentMethods(data.paymentMethods || []);
        setCatalogDocTypes(data.documentTypes || []);
        toast.success(`Catálogos de ${provider.toUpperCase()} actualizados (${data.items?.length || 0} ítems)`);
      }
    } catch (e: any) {
      toast.error(`No se pudieron cargar los catálogos: ${e.message}`);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const handleTestConnection = () => {
    const payload: any = { provider };
    if (provider === "alegra") {
      payload.alegraEmail = alegraEmail;
      payload.alegraToken = alegraToken;
    } else if (provider === "siigo") {
      payload.siigoUsername = siigoUsername;
      payload.siigoAccessKey = siigoAccessKey;
      payload.siigoPartnerId = siigoPartnerId;
    } else if (provider === "world_office") {
      payload.worldOfficeToken = worldOfficeToken;
      payload.worldOfficeCompanyId = worldOfficeCompanyId;
    }

    if (mode === "tenant") {
      testTenantMutation.mutate(payload);
    } else {
      testAdminMutation.mutate(payload);
    }
  };

  const handleSave = () => {
    const payload: any = {
      provider,
      enabled,
      environment,
      autoInvoice,
      autoSendEmail,
      resolutionNumber: resolutionNumber || undefined,
      alegraEmail: alegraEmail || undefined,
      alegraToken: alegraToken || undefined,
      alegraDefaultItemId: alegraDefaultItemId || undefined,
      alegraDefaultTaxId: alegraDefaultTaxId || undefined,
      alegraPaymentMethodId: alegraPaymentMethodId || undefined,
      alegraPaymentAccountId: alegraPaymentAccountId || undefined,
      alegraUseElectronicStamp,
      siigoUsername: siigoUsername || undefined,
      siigoAccessKey: siigoAccessKey || undefined,
      siigoPartnerId: siigoPartnerId || "EVGreenSaaS",
      siigoDocumentId: siigoDocumentId || undefined,
      siigoSellerId: siigoSellerId || undefined,
      siigoPaymentTypeId: siigoPaymentTypeId || undefined,
      siigoProductCode: siigoProductCode || undefined,
      siigoTaxId: siigoTaxId || undefined,
      siigoStamp: siigoStamp,
      siigoMail: siigoMail,
      worldOfficeToken: worldOfficeToken || undefined,
      worldOfficeCompanyId: worldOfficeCompanyId || undefined,
      worldOfficeDocumentTypeId: worldOfficeDocumentTypeId || undefined,
      worldOfficePrefixId: worldOfficePrefixId || undefined,
      worldOfficePaymentMethodId: worldOfficePaymentMethodId || undefined,
      worldOfficeItemId: worldOfficeItemId || undefined,
      worldOfficeTaxId: worldOfficeTaxId || undefined,
    };

    if (mode === "tenant") {
      saveTenantMutation.mutate(payload);
    } else {
      saveAdminMutation.mutate(payload);
    }
  };

  const isTesting = testTenantMutation.isPending || testAdminMutation.isPending;
  const isSaving = saveTenantMutation.isPending || saveAdminMutation.isPending;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-green-500" />
            Cargando configuración de facturación electrónica...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta Principal de Configuración */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                Facturación Electrónica DIAN
              </CardTitle>
              <CardDescription>
                Emite automáticamente la factura de venta en Colombia al culminar cada recarga según los kWh vendidos.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={enabled ? "default" : "secondary"} className={enabled ? "bg-green-600 hover:bg-green-700" : ""}>
                {enabled ? "Activo" : "Inactivo"}
              </Badge>
              {config?.lastTestStatus === "success" && (
                <Badge variant="outline" className="text-green-500 border-green-500/30 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </Badge>
              )}
              {config?.lastTestStatus === "error" && (
                <Badge variant="outline" className="text-red-500 border-red-500/30 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Error
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Selector visual de Proveedor */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Selecciona tu Proveedor de Facturación Electrónica</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Opción 1: Alegra */}
              <div
                onClick={() => setProvider("alegra")}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                  provider === "alegra"
                    ? "border-green-500 bg-green-500/10 ring-2 ring-green-500/20"
                    : "border-border/60 hover:border-border hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base text-foreground">Alegra</span>
                  {provider === "alegra" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Líder cloud en Colombia. Facturas directas, timbrado DIAN y catálogo de productos.
                </p>
              </div>

              {/* Opción 2: Siigo Nube */}
              <div
                onClick={() => setProvider("siigo")}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                  provider === "siigo"
                    ? "border-green-500 bg-green-500/10 ring-2 ring-green-500/20"
                    : "border-border/60 hover:border-border hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base text-foreground">Siigo Nube</span>
                  {provider === "siigo" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  API REST oficial con Partner-ID, timbrado automático de CUFE y catálogo sincronizado.
                </p>
              </div>

              {/* Opción 3: World Office Cloud */}
              <div
                onClick={() => setProvider("world_office")}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                  provider === "world_office"
                    ? "border-green-500 bg-green-500/10 ring-2 ring-green-500/20"
                    : "border-border/60 hover:border-border hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base text-foreground">World Office Cloud</span>
                  {provider === "world_office" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sistema ERP contable robusto en Colombia. Conexión por Token y prefijos de sucursal.
                </p>
              </div>
            </div>
          </div>

          {/* Opciones Generales de Automatización */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Habilitar Facturación Electrónica</Label>
                <p className="text-xs text-muted-foreground">Activa el motor de facturación para este tenant</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Facturación Automática al Finalizar Carga</Label>
                <p className="text-xs text-muted-foreground">Emite la factura sin intervención manual al parar el conector</p>
              </div>
              <Switch checked={autoInvoice} onCheckedChange={setAutoInvoice} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enviar Factura por Correo</Label>
                <p className="text-xs text-muted-foreground">Envía el PDF y comprobante DIAN al cliente automáticamente</p>
              </div>
              <Switch checked={autoSendEmail} onCheckedChange={setAutoSendEmail} />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Ambiente</Label>
              <Select value={environment} onValueChange={(val: any) => setEnvironment(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Producción (DIAN Real)</SelectItem>
                  <SelectItem value="sandbox">Sandbox / Pruebas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos Específicos de ALEGRA */}
          {provider === "alegra" && (
            <div className="space-y-4 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-green-500" />
                  Credenciales y Parámetros de Alegra
                </h3>
                <a
                  href="https://app.alegra.com/configuration/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-500 hover:underline flex items-center gap-1"
                >
                  Obtener token de Alegra <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Correo de Usuario en Alegra *</Label>
                  <Input
                    placeholder="micorreo@empresa.com"
                    value={alegraEmail}
                    onChange={(e) => setAlegraEmail(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Token de API de Alegra *</Label>
                  <Input
                    type="password"
                    placeholder={alegraTokenSaved ? "•••••••• (Guardado)" : "Token de API"}
                    value={alegraToken}
                    onChange={(e) => setAlegraToken(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Producto / Servicio de Energía</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadCatalogs}
                      disabled={loadingCatalogs || !alegraEmail}
                      className="h-6 text-xs text-green-500 px-2"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${loadingCatalogs ? "animate-spin" : ""}`} />
                      Cargar de Alegra
                    </Button>
                  </div>
                  {catalogItems.length > 0 ? (
                    <Select value={alegraDefaultItemId} onValueChange={setAlegraDefaultItemId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecciona el producto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} {item.code ? `(${item.code})` : ""} - ${item.price?.toLocaleString("es-CO") || 0}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="ID del ítem en Alegra (ej: 1)"
                      value={alegraDefaultItemId}
                      onChange={(e) => setAlegraDefaultItemId(e.target.value)}
                      className="h-9"
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Corresponde a "Servicio de recarga de energía" en tu cuenta de Alegra.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Impuesto Asociado (IVA)</Label>
                  {catalogTaxes.length > 0 ? (
                    <Select value={alegraDefaultTaxId} onValueChange={setAlegraDefaultTaxId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecciona el impuesto..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguno (0%)</SelectItem>
                        {catalogTaxes.map((tax) => (
                          <SelectItem key={tax.id} value={tax.id}>
                            {tax.name} ({tax.percentage}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="ID de impuesto (ej: Ninguno)"
                      value={alegraDefaultTaxId}
                      onChange={(e) => setAlegraDefaultTaxId(e.target.value)}
                      className="h-9"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Método de Pago Predeterminado</Label>
                  {catalogPaymentMethods.length > 0 ? (
                    <Select value={alegraPaymentMethodId} onValueChange={setAlegraPaymentMethodId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecciona método de pago..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogPaymentMethods.map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>
                            {pm.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Método de pago (ej: credit-card, cash)"
                      value={alegraPaymentMethodId}
                      onChange={(e) => setAlegraPaymentMethodId(e.target.value)}
                      className="h-9"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">ID de Plantilla de Numeración / Resolución</Label>
                  <Input
                    placeholder="ID plantilla resolución DIAN en Alegra"
                    value={resolutionNumber}
                    onChange={(e) => setResolutionNumber(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Timbrado Electrónico DIAN Automático</Label>
                  <p className="text-[11px] text-muted-foreground">Genera el XML firmado y CUFE ante la DIAN al instante</p>
                </div>
                <Switch checked={alegraUseElectronicStamp} onCheckedChange={setAlegraUseElectronicStamp} />
              </div>
            </div>
          )}

          {/* Campos Específicos de SIIGO */}
          {provider === "siigo" && (
            <div className="space-y-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-blue-500" />
                  Credenciales y Parámetros de Siigo Nube
                </h3>
                <a
                  href="https://siigonube.portaldeclientes.siigo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                >
                  Portal Siigo <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Usuario de API Siigo (Email) *</Label>
                  <Input
                    placeholder="usuario@empresa.com"
                    value={siigoUsername}
                    onChange={(e) => setSiigoUsername(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Access Key (API Key) *</Label>
                  <Input
                    type="password"
                    placeholder={siigoAccessKeySaved ? "•••••••• (Guardado)" : "Clave de acceso API de Siigo"}
                    value={siigoAccessKey}
                    onChange={(e) => setSiigoAccessKey(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
                <div className="space-y-1">
                  <Label className="text-xs">Partner-ID</Label>
                  <Input
                    value={siigoPartnerId}
                    onChange={(e) => setSiigoPartnerId(e.target.value)}
                    placeholder="EVGreenSaaS"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Código de Producto de Energía</Label>
                  <Input
                    value={siigoProductCode}
                    onChange={(e) => setSiigoProductCode(e.target.value)}
                    placeholder="EV-KWH-01"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">ID de Tipo de Documento (Factura de Venta)</Label>
                  <Input
                    value={siigoDocumentId}
                    onChange={(e) => setSiigoDocumentId(e.target.value)}
                    placeholder="Ej: 24 (Factura de venta)"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">ID de Vendedor / Asesor</Label>
                  <Input
                    value={siigoSellerId}
                    onChange={(e) => setSiigoSellerId(e.target.value)}
                    placeholder="ID del usuario asesor en Siigo"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Timbrar ante la DIAN (Stamp: true)</Label>
                  <p className="text-[11px] text-muted-foreground">Emite la factura electrónica certificada con CUFE</p>
                </div>
                <Switch checked={siigoStamp} onCheckedChange={setSiigoStamp} />
              </div>
            </div>
          )}

          {/* Campos Específicos de WORLD OFFICE */}
          {provider === "world_office" && (
            <div className="space-y-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-500" />
                  Credenciales y Parámetros de World Office Cloud
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Token de API World Office *</Label>
                  <Input
                    type="password"
                    placeholder={worldOfficeTokenSaved ? "•••••••• (Guardado)" : "Token de acceso World Office"}
                    value={worldOfficeToken}
                    onChange={(e) => setWorldOfficeToken(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">ID de Empresa (idEmpresa) *</Label>
                  <Input
                    placeholder="1"
                    value={worldOfficeCompanyId}
                    onChange={(e) => setWorldOfficeCompanyId(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/30">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Documento</Label>
                  <Input
                    value={worldOfficeDocumentTypeId}
                    onChange={(e) => setWorldOfficeDocumentTypeId(e.target.value)}
                    placeholder="1 (Factura)"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Prefijo de Factura</Label>
                  <Input
                    value={worldOfficePrefixId}
                    onChange={(e) => setWorldOfficePrefixId(e.target.value)}
                    placeholder="EVG"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">ID de Ítem de Inventario (Energía)</Label>
                  <Input
                    value={worldOfficeItemId}
                    onChange={(e) => setWorldOfficeItemId(e.target.value)}
                    placeholder="1"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Barra de Acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="gap-2"
              >
                <Zap className={`h-4 w-4 ${isTesting ? "animate-spin text-green-500" : "text-amber-500"}`} />
                {isTesting ? "Comprobando..." : "Probar Conexión"}
              </Button>

              {config?.lastTestedAt && (
                <span className="text-xs text-muted-foreground">
                  Última prueba: {new Date(config.lastTestedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 font-medium"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Guardar Configuración
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
