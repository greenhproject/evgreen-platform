/**
 * Componente de Configuración de Facturación Electrónica Multi-Proveedor
 * Compatible con Alegra, Siigo Nube y World Office Cloud
 * Modos: 'tenant' (portal de organización SaaS) o 'admin' (plataforma global)
 * 
 * Flujo optimizado:
 * - El usuario escribe el nombre o código del producto ("Servicio de recarga de energía", etc.)
 * - El sistema API busca en vivo el ítem en el proveedor y lo deja seleccionado
 * - Precarga automáticamente precio unitario e IVA desde el catálogo del proveedor
 * - Al terminar una carga, EVGreen sólo envía la cantidad de kWh vendidos
 * - Incluye webhook para confirmación asíncrona de timbrado DIAN
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
  KeyRound,
  ExternalLink,
  Search,
  Sparkles,
  Link,
  Copy,
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

  const syncProductMutation = (trpc.organizations as any).selectAndSyncMyBillingProduct.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || "Producto sincronizado correctamente");
      setSelectedProductId(data.product.id);
      setSelectedProductName(data.product.name);
      setSelectedProductCode(data.product.code || "");
      setSelectedProductPrice(data.product.price || 0);
      setSelectedProductTaxes(data.product.taxName ? `${data.product.taxName} (${data.product.taxPercentage || 0}%)` : "Sin impuesto");
      setSelectedProductUnit(data.product.unit || "unidad");
      setSearchResults([]);
      (utils.organizations as any).getMyElectronicBillingConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error sincronizando producto: ${err.message}`),
  });

  // Estado del formulario
  const [provider, setProvider] = useState<"alegra" | "siigo" | "world_office">("alegra");
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("production");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [resolutionNumber, setResolutionNumber] = useState("");

  // Búsqueda interactiva de producto
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Snapshot del producto sincronizado
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [selectedProductPrice, setSelectedProductPrice] = useState<number | null>(null);
  const [selectedProductTaxes, setSelectedProductTaxes] = useState<string | null>(null);
  const [selectedProductUnit, setSelectedProductUnit] = useState("");

  // Credenciales Alegra
  const [alegraEmail, setAlegraEmail] = useState("");
  const [alegraToken, setAlegraToken] = useState("");
  const [alegraTokenSaved, setAlegraTokenSaved] = useState(false);
  const [alegraDefaultTaxId, setAlegraDefaultTaxId] = useState("");
  const [alegraPaymentMethodId, setAlegraPaymentMethodId] = useState("");
  const [alegraPaymentAccountId, setAlegraPaymentAccountId] = useState("");
  const [alegraUseElectronicStamp, setAlegraUseElectronicStamp] = useState(true);

  // Credenciales Siigo
  const [siigoUsername, setSiigoUsername] = useState("");
  const [siigoAccessKey, setSiigoAccessKey] = useState("");
  const [siigoAccessKeySaved, setSiigoAccessKeySaved] = useState(false);
  const [siigoPartnerId, setSiigoPartnerId] = useState("EVGreenSaaS");
  const [siigoDocumentId, setSiigoDocumentId] = useState("");
  const [siigoSellerId, setSiigoSellerId] = useState("");
  const [siigoPaymentTypeId, setSiigoPaymentTypeId] = useState("");
  const [siigoStamp, setSiigoStamp] = useState(true);
  const [siigoMail, setSiigoMail] = useState(true);

  // Credenciales World Office
  const [worldOfficeToken, setWorldOfficeToken] = useState("");
  const [worldOfficeTokenSaved, setWorldOfficeTokenSaved] = useState(false);
  const [worldOfficeCompanyId, setWorldOfficeCompanyId] = useState("1");
  const [worldOfficeDocumentTypeId, setWorldOfficeDocumentTypeId] = useState("1");
  const [worldOfficePrefixId, setWorldOfficePrefixId] = useState("");
  const [worldOfficePaymentMethodId, setWorldOfficePaymentMethodId] = useState("1");

  // Webhook
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/billing/webhook` : "/api/billing/webhook";

  // Sincronizar estado inicial desde DB
  useEffect(() => {
    if (config) {
      setProvider((config.provider as any) || "alegra");
      setEnabled(!!config.enabled);
      setEnvironment((config.environment as any) || "production");
      setAutoInvoice(config.autoInvoice !== false);
      setAutoSendEmail(config.autoSendEmail !== false);
      setResolutionNumber(config.resolutionNumber || "");

      // Snapshot producto
      setSelectedProductId(config.selectedProductId || config.alegraDefaultItemId || config.worldOfficeItemId || "");
      setSelectedProductName(config.selectedProductName || (config.selectedProductId ? "Producto configurado" : ""));
      setSelectedProductCode(config.selectedProductCode || config.siigoProductCode || "");
      setSelectedProductPrice(config.selectedProductPrice ? parseFloat(config.selectedProductPrice) : null);
      setSelectedProductTaxes(config.selectedProductTaxes || null);
      setSelectedProductUnit(config.selectedProductUnit || "unidad");

      // Alegra
      setAlegraEmail(config.alegraEmail || "");
      setAlegraTokenSaved(!!config.alegraToken);
      setAlegraToken(config.alegraToken || "");
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
      setSiigoStamp(config.siigoStamp !== false);
      setSiigoMail(config.siigoMail !== false);

      // World Office
      setWorldOfficeTokenSaved(!!config.worldOfficeToken);
      setWorldOfficeToken(config.worldOfficeToken || "");
      setWorldOfficeCompanyId(config.worldOfficeCompanyId || "1");
      setWorldOfficeDocumentTypeId(config.worldOfficeDocumentTypeId || "1");
      setWorldOfficePrefixId(config.worldOfficePrefixId || "");
      setWorldOfficePaymentMethodId(config.worldOfficePaymentMethodId || "1");
    }
  }, [config]);

  // Buscar en vivo el producto en la API del proveedor
  const handleSearchProduct = async () => {
    if (!productSearchQuery.trim()) {
      toast.info("Escribe el nombre o código del producto a buscar (ej: Servicio de recarga)");
      return;
    }
    setIsSearchingProduct(true);
    try {
      let items: any[] = [];
      if (mode === "tenant") {
        items = await (utils.organizations as any).searchMyBillingItems.fetch({
          query: productSearchQuery.trim(),
          provider,
        });
      } else {
        const cat = await (utils.settings as any).billingListPlatformCatalogs.fetch({ provider });
        items = (cat?.items || []).filter((i: any) =>
          i.name?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          i.code?.toLowerCase().includes(productSearchQuery.toLowerCase())
        );
      }
      setSearchResults(items || []);
      if (!items || items.length === 0) {
        toast.info(`No se encontraron productos coincidentes en ${provider.toUpperCase()}`);
      } else {
        toast.success(`Se encontraron ${items.length} producto(s) en ${provider.toUpperCase()}`);
      }
    } catch (e: any) {
      toast.error(`Error buscando productos: ${e.message}`);
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const handleSelectProduct = (item: any) => {
    if (mode === "tenant") {
      syncProductMutation.mutate({ productId: item.id, provider });
    } else {
      setSelectedProductId(item.id);
      setSelectedProductName(item.name);
      setSelectedProductCode(item.code || "");
      setSelectedProductPrice(item.price || 0);
      setSelectedProductTaxes(item.taxName ? `${item.taxName} (${item.taxPercentage || 0}%)` : "Predeterminado");
      setSelectedProductUnit(item.unit || "unidad");
      setSearchResults([]);
      toast.success(`Producto "${item.name}" seleccionado para facturación global.`);
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
      selectedProductId: selectedProductId || undefined,
      selectedProductName: selectedProductName || undefined,
      selectedProductCode: selectedProductCode || undefined,
      selectedProductPrice: selectedProductPrice !== null ? selectedProductPrice : undefined,
      selectedProductTaxes: selectedProductTaxes || undefined,
      selectedProductUnit: selectedProductUnit || undefined,
      alegraEmail: alegraEmail || undefined,
      alegraToken: alegraToken || undefined,
      alegraDefaultItemId: selectedProductId || undefined,
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
      siigoProductCode: selectedProductCode || "EV-KWH-01",
      siigoStamp: siigoStamp,
      siigoMail: siigoMail,
      worldOfficeToken: worldOfficeToken || undefined,
      worldOfficeCompanyId: worldOfficeCompanyId || undefined,
      worldOfficeDocumentTypeId: worldOfficeDocumentTypeId || undefined,
      worldOfficePrefixId: worldOfficePrefixId || undefined,
      worldOfficePaymentMethodId: worldOfficePaymentMethodId || undefined,
      worldOfficeItemId: selectedProductId || undefined,
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
                Conecta tu software contable. Solo buscas tu producto de energía una vez y la plataforma inyecta automáticamente los kWh vendidos.
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
            <Label className="text-sm font-semibold">1. Selecciona tu Proveedor de Facturación Electrónica</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  Líder en Colombia. Facturas directas, timbrado DIAN y webhook de emisión en tiempo real.
                </p>
              </div>

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

          {/* Credenciales del Proveedor */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold">2. Credenciales de Acceso API</Label>

            {provider === "alegra" && (
              <div className="space-y-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-green-400 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Autenticación básica Alegra API
                  </span>
                  <a
                    href="https://app.alegra.com/configuration/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-500 hover:underline flex items-center gap-1"
                  >
                    Obtener token de Alegra <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Correo de Usuario en Alegra *</Label>
                    <Input
                      placeholder="correo@empresa.com"
                      value={alegraEmail}
                      onChange={(e) => setAlegraEmail(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
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
              </div>
            )}

            {provider === "siigo" && (
              <div className="space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Usuario de API Siigo (Email) *</Label>
                    <Input
                      placeholder="usuario@empresa.com"
                      value={siigoUsername}
                      onChange={(e) => setSiigoUsername(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Access Key (API Key) *</Label>
                    <Input
                      type="password"
                      placeholder={siigoAccessKeySaved ? "•••••••• (Guardado)" : "Clave de acceso API"}
                      value={siigoAccessKey}
                      onChange={(e) => setSiigoAccessKey(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {provider === "world_office" && (
              <div className="space-y-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Token de API World Office *</Label>
                    <Input
                      type="password"
                      placeholder={worldOfficeTokenSaved ? "•••••••• (Guardado)" : "Token de acceso"}
                      value={worldOfficeToken}
                      onChange={(e) => setWorldOfficeToken(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ID de Empresa (idEmpresa) *</Label>
                    <Input
                      placeholder="1"
                      value={worldOfficeCompanyId}
                      onChange={(e) => setWorldOfficeCompanyId(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN CLAVE: Buscar y Seleccionar Producto del Proveedor */}
          <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-green-500" />
                  3. Producto o Servicio de Energía en {provider.toUpperCase()}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escribe el nombre del ítem creado en tu software contable (ej: "Servicio de recarga de energia") para buscarlo y seleccionarlo.
                </p>
              </div>
            </div>

            {/* Buscador interactivo */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto... ej: Servicio de recarga de energia"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchProduct()}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSearchProduct}
                disabled={isSearchingProduct}
                className="gap-1.5 h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSearchingProduct ? "animate-spin text-green-500" : ""}`} />
                {isSearchingProduct ? "Buscando..." : "Buscar en API"}
              </Button>
            </div>

            {/* Resultados de la búsqueda */}
            {searchResults.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-background p-2 space-y-1.5 max-h-56 overflow-y-auto">
                <span className="text-[11px] font-medium text-muted-foreground px-2">Selecciona un producto del catálogo:</span>
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectProduct(item)}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 cursor-pointer text-xs border border-transparent hover:border-border/40 transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{item.name}</span>
                      {item.code && <span className="text-muted-foreground ml-2">({item.code})</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-green-500 font-medium">
                        ${(item.price || 0).toLocaleString("es-CO")}/{item.unit || "kWh"}
                      </span>
                      {item.taxName && <Badge variant="outline" className="text-[10px]">{item.taxName}</Badge>}
                      <Button size="sm" variant="secondary" className="h-6 text-[11px] px-2">
                        Seleccionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tarjeta del Producto Actualmente Seleccionado y Sincronizado */}
            {selectedProductId ? (
              <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-xs text-foreground">
                      {selectedProductName || "Servicio de recarga de energía"}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                      ID: #{selectedProductId}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tarifa base: ${selectedProductPrice?.toLocaleString("es-CO") || "1"} COP / {selectedProductUnit || "kWh"} · Impuesto: {selectedProductTaxes || "Configurado en proveedor"}
                  </p>
                </div>
                <div className="text-[11px] text-green-400 font-medium bg-green-500/20 px-2.5 py-1 rounded-md self-start sm:self-auto">
                  EVGreen solo enviará cantidad = kWh
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                Ningún producto seleccionado aún. Realiza una búsqueda arriba para enlazar tu ítem de energía.
              </div>
            )}
          </div>

          {/* Opciones de Automatización e Integración */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Habilitar Facturación</Label>
                <p className="text-xs text-muted-foreground">Activa el servicio para este tenant</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Emisión Automática al Finalizar Carga</Label>
                <p className="text-xs text-muted-foreground">Genera y timbra la factura en el conector</p>
              </div>
              <Switch checked={autoInvoice} onCheckedChange={setAutoInvoice} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enviar Factura por Correo</Label>
                <p className="text-xs text-muted-foreground">Envía el PDF y comprobante al cliente</p>
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

          {/* Webhook para Confirmación DIAN */}
          <div className="p-4 rounded-xl border border-border/40 bg-muted/10 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5 text-green-500" />
                4. Webhook de Confirmación y Timbrado DIAN
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success("URL de webhook copiada al portapapeles");
                }}
                className="h-6 text-xs gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar URL
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configura esta URL en los webhooks de tu software contable (evento: <code>invoices.emissionFinished</code> en Alegra) para recibir la confirmación de timbrado, CUFE y XML en tiempo real:
            </p>
            <div className="p-2 rounded bg-background border font-mono text-xs text-foreground truncate select-all">
              {webhookUrl}
            </div>
          </div>

          {/* Botones de Acción */}
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
