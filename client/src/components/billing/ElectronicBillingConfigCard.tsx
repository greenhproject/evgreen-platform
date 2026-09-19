/**
 * Componente de Configuración de Facturación Electrónica Multi-Proveedor
 * Compatible con Alegra, Siigo Nube y World Office Cloud
 * Modos: 'tenant' (portal de organización SaaS) o 'admin' (plataforma global o tenant específico)
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
  Calculator,
} from "lucide-react";

const ALEGRA_PAYMENT_METHODS = [
  { value: "transfer", label: "Transferencia / pago electrónico" },
  { value: "cash", label: "Efectivo" },
  { value: "deposit", label: "Consignación" },
  { value: "debit-card", label: "Tarjeta débito" },
  { value: "credit-card", label: "Tarjeta crédito" },
  { value: "check", label: "Cheque" },
];

interface Props {
  mode?: "tenant" | "admin";
  organizationId?: number | null;
}

export default function ElectronicBillingConfigCard({ mode = "tenant", organizationId }: Props) {
  const utils = trpc.useUtils();
  const isSuperadminTargetingTenant = mode === "admin" && !!organizationId;

  // Queries según modo
  const tenantConfigQuery = (trpc.organizations as any).getMyElectronicBillingConfig.useQuery(undefined, {
    enabled: mode === "tenant",
  });
  const adminPlatformQuery = (trpc.settings as any).billingGetPlatformConfig.useQuery(undefined, {
    enabled: mode === "admin" && !organizationId,
  });
  const adminTenantQuery = (trpc.organizations as any).getTenantBillingConfigAdmin.useQuery(
    { organizationId: organizationId! },
    { enabled: isSuperadminTargetingTenant }
  );

  // Mutaciones
  const saveTenantMutation = (trpc.organizations as any).saveMyElectronicBillingConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración de facturación guardada exitosamente");
      (utils.organizations as any).getMyElectronicBillingConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error al guardar: ${err.message}`),
  });

  const saveAdminPlatformMutation = (trpc.settings as any).billingSavePlatformConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración global de facturación guardada exitosamente");
      (utils.settings as any).billingGetPlatformConfig.invalidate();
    },
    onError: (err: any) => toast.error(`Error al guardar: ${err.message}`),
  });

  const saveAdminTenantMutation = (trpc.organizations as any).saveTenantBillingConfigAdmin.useMutation({
    onSuccess: () => {
      toast.success("Configuración del tenant guardada por Superadmin");
      (utils.organizations as any).getTenantBillingConfigAdmin.invalidate({ organizationId: organizationId! });
    },
    onError: (err: any) => toast.error(`Error al guardar tenant: ${err.message}`),
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

  const testAdminPlatformMutation = (trpc.settings as any).billingTestPlatformConnection.useMutation({
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
      if (mode === "tenant") {
        (utils.organizations as any).getMyElectronicBillingConfig.invalidate();
      } else if (isSuperadminTargetingTenant) {
        (utils.organizations as any).getTenantBillingConfigAdmin.invalidate({ organizationId: organizationId! });
      }
    },
    onError: (err: any) => toast.error(`Error sincronizando producto: ${err.message}`),
  });

  // Estado del formulario
  const [provider, setProvider] = useState<"alegra" | "siigo" | "world_office">("alegra");
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("production");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [billingRoundingMode, setBillingRoundingMode] = useState<"nearest_integer" | "two_decimals">("two_decimals");
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
  const [alegraEProviderToken, setAlegraEProviderToken] = useState("");
  const [alegraEProviderTokenSaved, setAlegraEProviderTokenSaved] = useState(false);
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

  const tenantCatalogsQuery = (trpc.organizations as any).listMyBillingCatalogs.useQuery(
    { provider },
    { enabled: mode === "tenant" }
  );
  const adminPlatformCatalogsQuery = (trpc.settings as any).billingListPlatformCatalogs.useQuery(
    { provider },
    { enabled: mode === "admin" && !organizationId }
  );
  const adminTenantCatalogsQuery = (trpc.organizations as any).getTenantBillingCatalogsAdmin.useQuery(
    { organizationId: organizationId!, provider },
    { enabled: isSuperadminTargetingTenant }
  );

  const config = isSuperadminTargetingTenant
    ? adminTenantQuery.data
    : mode === "tenant"
    ? tenantConfigQuery.data
    : adminPlatformQuery.data;

  const catalogs = isSuperadminTargetingTenant
    ? adminTenantCatalogsQuery.data
    : mode === "tenant"
    ? tenantCatalogsQuery.data
    : adminPlatformCatalogsQuery.data;

  const isLoading = isSuperadminTargetingTenant
    ? adminTenantQuery.isLoading
    : mode === "tenant"
    ? tenantConfigQuery.isLoading
    : adminPlatformQuery.isLoading;

  const alegraBankAccounts = (catalogs?.bankAccounts || []) as Array<{ id: string; name: string; status?: string }>;

  useEffect(() => {
    if (provider !== "alegra" || !catalogs) return;
    const today = new Date().toISOString().slice(0, 10);
    const validTemplates = ((catalogs.documentTypes || []) as any[]).filter((template) => {
      if (!template.isElectronic || template.isActive === false) return false;
      if (template.startDate && today < String(template.startDate).slice(0, 10)) return false;
      if (template.endDate && today > String(template.endDate).slice(0, 10)) return false;
      return true;
    });
    const configured = String(resolutionNumber || "").trim();
    const selected = validTemplates.find((template) =>
      String(template.id) === configured || String(template.resolutionNumber || "") === configured
    )
      || validTemplates.find((template) => template.isDefault)
      || [...validTemplates].sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")))[0];
    if (selected?.resolutionNumber && selected.resolutionNumber !== resolutionNumber) {
      setResolutionNumber(selected.resolutionNumber);
    }
    if (alegraBankAccounts.length > 0 && !alegraBankAccounts.some((account) => account.id === alegraPaymentAccountId)) {
      const cajaGeneral = alegraBankAccounts.find((account) => /caja\s*general|principal/i.test(account.name));
      setAlegraPaymentAccountId(cajaGeneral?.id || alegraBankAccounts[0].id);
    }
  }, [provider, catalogs, resolutionNumber, alegraPaymentAccountId, alegraBankAccounts.length]);

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
      setBillingRoundingMode((config.billingRoundingMode as any) || "two_decimals");
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
      setAlegraEProviderTokenSaved(!!config.alegraEProviderToken);
      setAlegraEProviderToken(config.alegraEProviderToken || "");
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

  // Manejador de búsqueda de producto en vivo
  const handleSearchProduct = async () => {
    if (!productSearchQuery.trim()) {
      toast.warning("Ingresa un término de búsqueda (ej. Servicio de recarga)");
      return;
    }
    setIsSearchingProduct(true);
    try {
      let items: any[] = [];
      if (mode === "tenant") {
        items = await (utils.client as any).organizations.searchMyBillingItems.query({
          query: productSearchQuery,
          provider,
        });
      } else {
        const result = isSuperadminTargetingTenant
          ? await (utils.client as any).organizations.getTenantBillingCatalogsAdmin.query({
              organizationId: organizationId!,
              provider,
              query: productSearchQuery.trim(),
            })
          : await (utils.client as any).settings.billingListPlatformCatalogs.query({
              provider,
              query: productSearchQuery.trim(),
            });
        items = result?.items || [];
      }
      setSearchResults(items || []);
      if (!items || items.length === 0) {
        toast.info(`No se encontraron productos coincidentes en ${provider.toUpperCase()}`);
      }
    } catch (err: any) {
      toast.error(`Error consultando productos: ${err.message}`);
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(String(product.id));
    setSelectedProductName(product.name || "Servicio de recarga de energía");
    setSelectedProductCode(product.code || "");
    setSelectedProductPrice(product.price !== undefined ? product.price : 0);
    setSelectedProductTaxes(product.taxName ? `${product.taxName} (${product.taxPercentage || 0}%)` : "Sin impuesto");
    setSelectedProductUnit(product.unit || "unidad");
    setSearchResults([]);

    if (mode === "tenant") {
      syncProductMutation.mutate({
        productId: String(product.id),
        provider,
      });
    } else {
      toast.success(`Producto "${product.name}" seleccionado en borrador. Guarda para confirmar.`);
    }
  };

  const handleSave = () => {
    const payload: any = {
      provider,
      enabled,
      environment,
      autoInvoice,
      autoSendEmail,
      billingRoundingMode,
      resolutionNumber,
      selectedProductId,
      selectedProductName,
      selectedProductCode,
      selectedProductPrice,
      selectedProductTaxes,
      selectedProductUnit,
      alegraEmail,
      alegraToken: alegraToken.startsWith("****") ? undefined : alegraToken,
      alegraEProviderToken: alegraEProviderToken.startsWith("****") ? undefined : alegraEProviderToken,
      alegraDefaultItemId: selectedProductId || undefined,
      alegraDefaultTaxId,
      alegraPaymentMethodId,
      alegraPaymentAccountId,
      alegraUseElectronicStamp,
      siigoUsername,
      siigoAccessKey: siigoAccessKey.startsWith("****") ? undefined : siigoAccessKey,
      siigoPartnerId,
      siigoDocumentId,
      siigoSellerId,
      siigoPaymentTypeId,
      siigoProductCode: selectedProductCode || undefined,
      siigoStamp,
      siigoMail,
      worldOfficeToken: worldOfficeToken.startsWith("****") ? undefined : worldOfficeToken,
      worldOfficeCompanyId,
      worldOfficeDocumentTypeId,
      worldOfficePrefixId,
      worldOfficePaymentMethodId,
      worldOfficeItemId: selectedProductId || undefined,
    };

    if (isSuperadminTargetingTenant) {
      saveAdminTenantMutation.mutate({ organizationId: organizationId!, ...payload });
    } else if (mode === "tenant") {
      saveTenantMutation.mutate(payload);
    } else {
      saveAdminPlatformMutation.mutate(payload);
    }
  };

  const handleTestConnection = () => {
    const payload: any = { provider };
    if (provider === "alegra") {
      payload.alegraEmail = alegraEmail;
      payload.alegraToken = alegraToken.startsWith("****") ? undefined : alegraToken;
    } else if (provider === "siigo") {
      payload.siigoUsername = siigoUsername;
      payload.siigoAccessKey = siigoAccessKey.startsWith("****") ? undefined : siigoAccessKey;
      payload.siigoPartnerId = siigoPartnerId;
    } else if (provider === "world_office") {
      payload.worldOfficeToken = worldOfficeToken.startsWith("****") ? undefined : worldOfficeToken;
      payload.worldOfficeCompanyId = worldOfficeCompanyId;
    }

    if (mode === "tenant") {
      testTenantMutation.mutate(payload);
    } else {
      testAdminPlatformMutation.mutate(payload);
    }
  };

  const isSaving = saveTenantMutation.isPending || saveAdminPlatformMutation.isPending || saveAdminTenantMutation.isPending;
  const isTesting = testTenantMutation.isPending || testAdminPlatformMutation.isPending;
  const [isConfiguringWebhook, setIsConfiguringWebhook] = useState(false);

  const configureTenantWebhookMutation = (trpc.organizations as any).configureMyBillingWebhook.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.message || "Webhook configurado exitosamente");
        (utils.organizations as any).getMyElectronicBillingConfig.invalidate();
      } else {
        toast.error(`Error configurando webhook: ${data.error}`);
      }
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const configurePlatformWebhookMutation = (trpc.settings as any).billingConfigurePlatformWebhook.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.message || "Webhook configurado exitosamente");
        (utils.settings as any).billingGetPlatformConfig.invalidate();
      } else {
        toast.error(`Error configurando webhook: ${data.error}`);
      }
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const handleConfigureWebhook = async () => {
    setIsConfiguringWebhook(true);
    try {
      if (mode === "tenant") {
        await configureTenantWebhookMutation.mutateAsync({
          webhookUrl,
          provider,
          alegraEProviderToken: alegraEProviderToken.startsWith("****") ? undefined : (alegraEProviderToken || undefined),
        });
      } else {
        await configurePlatformWebhookMutation.mutateAsync({
          webhookUrl,
          provider,
          alegraEProviderToken: alegraEProviderToken.startsWith("****") ? undefined : (alegraEProviderToken || undefined),
        });
      }
    } finally {
      setIsConfiguringWebhook(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-green-500" />
          Cargando configuración de facturación electrónica...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                {isSuperadminTargetingTenant
                  ? `Facturación Electrónica — Tenant #${organizationId}`
                  : mode === "tenant"
                  ? "Facturación Electrónica (DIAN / SaaS)"
                  : "Facturación Electrónica Multi-Proveedor (Global)"}
              </CardTitle>
              {config?.lastTestStatus === "success" && (
                <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              )}
              {config?.lastTestStatus === "error" && (
                <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">
                  <AlertCircle className="h-3 w-3 mr-1" /> Error de Conexión
                </Badge>
              )}
            </div>
            <CardDescription>
              Selecciona el proveedor contable, busca el producto del catálogo y EVGreen inyectará automáticamente el total cobrado al finalizar la sesión.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="billing-enable-switch" />
              <Label htmlFor="billing-enable-switch" className="text-sm font-medium">
                {enabled ? "Habilitado" : "Deshabilitado"}
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Selector de Proveedor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setProvider("alegra")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              provider === "alegra"
                ? "border-green-500/80 bg-green-500/10 shadow-sm shadow-green-500/10 ring-1 ring-green-500/50"
                : "border-border/60 hover:border-border/90 bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">Alegra</span>
              {provider === "alegra" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              API REST v1 con timbrado DIAN nativo, catálogo de ítems y webhooks directos.
            </p>
          </div>

          <div
            onClick={() => setProvider("siigo")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              provider === "siigo"
                ? "border-blue-500/80 bg-blue-500/10 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/50"
                : "border-border/60 hover:border-border/90 bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">Siigo Nube</span>
              {provider === "siigo" && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              OAuth2 con Access Key y Partner ID para facturas electrónicas masivas en Colombia.
            </p>
          </div>

          <div
            onClick={() => setProvider("world_office")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              provider === "world_office"
                ? "border-amber-500/80 bg-amber-500/10 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/50"
                : "border-border/60 hover:border-border/90 bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">World Office Cloud</span>
              {provider === "world_office" && <CheckCircle2 className="h-4 w-4 text-amber-500" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Integración Cloud con Bearer Token e inventario discriminado por ID de empresa.
            </p>
          </div>
        </div>

        {/* Buscador y Selección de Producto */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Producto o Servicio de Facturación (Catálogo {provider.toUpperCase()})
              </h3>
            </div>
            {selectedProductId && (
              <Badge variant="outline" className="text-green-500 border-green-500/40 bg-green-500/10 text-xs">
                Sincronizado
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Escribe el nombre o código de tu producto en {provider.toUpperCase()} (ejemplo: <em>"Servicio de recarga de energía"</em>). El sistema lo buscará por API y precargará su IVA e identificador contable.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder='Escribe "Servicio de recarga", "Energía", "KWh"...'
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchProduct()}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSearchProduct}
              disabled={isSearchingProduct}
              className="gap-1.5"
            >
              {isSearchingProduct ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Buscar en API
            </Button>
          </div>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="rounded-lg border border-border/80 bg-card p-2 space-y-1 max-h-48 overflow-y-auto">
              <p className="text-[11px] font-medium text-muted-foreground px-2 py-1">Selecciona el producto contable:</p>
              {searchResults.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectProduct(item)}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <div className="text-[11px] text-muted-foreground flex gap-2">
                      <span>ID: {item.id}</span>
                      {item.code && <span>Código: {item.code}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-green-500 font-medium">
                      ${(item.price || 0).toLocaleString("es-CO")}
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {item.taxName || "Excluido de IVA"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Snapshot del producto actualmente enlazado */}
          {selectedProductId ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Producto enlazado</span>
                <span className="font-semibold text-foreground">{selectedProductName || "Servicio de recarga"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">ID Contable</span>
                <span className="font-mono text-foreground">#{selectedProductId}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Tratamiento Fiscal</span>
                <span className="text-foreground">{selectedProductTaxes || "Excluido de IVA (Art. 424 E.T.)"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Mecanismo de Cobro</span>
                <span className="text-green-500 font-medium">Inyección Dinámica (Total/kWh)</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Aún no hay un producto seleccionado. Busca tu servicio arriba para completar la parametrización contable.</span>
            </div>
          )}
        </div>

        {/* Credenciales según Proveedor */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-green-500" />
            Credenciales de Conexión ({provider.toUpperCase()})
          </h3>

          {provider === "alegra" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Correo de Usuario Alegra</Label>
                <Input
                  type="email"
                  placeholder="ejemplo@greenhouseproject.com"
                  value={alegraEmail}
                  onChange={(e) => setAlegraEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">API Token de Alegra</Label>
                <Input
                  type="password"
                  placeholder={alegraTokenSaved ? "Token guardado (dejar en blanco para conservar)" : "Ingresa tu API Token"}
                  value={alegraToken}
                  onChange={(e) => setAlegraToken(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Token de Proveedor Electrónico Alegra (Opcional para Webhook Automático)</Label>
                <Input
                  type="password"
                  placeholder={alegraEProviderTokenSaved ? "Token de Proveedor guardado" : "Bearer Token emitido por Alegra Proveedor Electrónico"}
                  value={alegraEProviderToken}
                  onChange={(e) => setAlegraEProviderToken(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Permite a EVGreen registrar el webhook directamente por API sin buscar menús manuales en Alegra.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Método de pago Alegra</Label>
                <Select value={alegraPaymentMethodId || "transfer"} onValueChange={setAlegraPaymentMethodId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecciona un método" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALEGRA_PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Alegra exige el código textual, no el número interno 1/2/3.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta de ingreso en Alegra</Label>
                <Select value={alegraPaymentAccountId || "none"} onValueChange={(value) => setAlegraPaymentAccountId(value === "none" ? "" : value)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Usar cuenta predeterminada</SelectItem>
                    {alegraBankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.name} (#{account.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Se guarda el ID interno de la cuenta, no el código PUC.</p>
              </div>
            </div>
          )}

          {provider === "siigo" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Usuario Siigo (Email API)</Label>
                <Input
                  type="email"
                  placeholder="usuario@tuempresa.com"
                  value={siigoUsername}
                  onChange={(e) => setSiigoUsername(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Access Key de Siigo</Label>
                <Input
                  type="password"
                  placeholder={siigoAccessKeySaved ? "Clave guardada" : "Ingresa Access Key"}
                  value={siigoAccessKey}
                  onChange={(e) => setSiigoAccessKey(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Partner ID</Label>
                <Input
                  placeholder="EVGreenSaaS"
                  value={siigoPartnerId}
                  onChange={(e) => setSiigoPartnerId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ID Documento Electrónico (Tipo Factura)</Label>
                <Input
                  placeholder="Ej: 24328"
                  value={siigoDocumentId}
                  onChange={(e) => setSiigoDocumentId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ID Vendedor (Seller ID)</Label>
                <Input
                  placeholder="Ej: 1"
                  value={siigoSellerId}
                  onChange={(e) => setSiigoSellerId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ID Forma de Pago</Label>
                <Input
                  placeholder="Ej: 5636"
                  value={siigoPaymentTypeId}
                  onChange={(e) => setSiigoPaymentTypeId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          {provider === "world_office" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Token de Integración World Office</Label>
                <Input
                  type="password"
                  placeholder={worldOfficeTokenSaved ? "Token guardado" : "Bearer Token oficial de World Office Cloud"}
                  value={worldOfficeToken}
                  onChange={(e) => setWorldOfficeToken(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ID Empresa (Company ID)</Label>
                <Input
                  placeholder="1"
                  value={worldOfficeCompanyId}
                  onChange={(e) => setWorldOfficeCompanyId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ID Tipo Documento</Label>
                <Input
                  placeholder="1"
                  value={worldOfficeDocumentTypeId}
                  onChange={(e) => setWorldOfficeDocumentTypeId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Prefijo / Resolución</Label>
                <Input
                  placeholder="FEV"
                  value={worldOfficePrefixId}
                  onChange={(e) => setWorldOfficePrefixId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ID Forma de Pago</Label>
                <Input
                  placeholder="1"
                  value={worldOfficePaymentMethodId}
                  onChange={(e) => setWorldOfficePaymentMethodId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Políticas de Emisión y Redondeo Contable */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-green-500" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Políticas de Emisión y Reglas de Redondeo Contable
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ambiente DIAN</Label>
              <Select value={environment} onValueChange={(v: any) => setEnvironment(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Producción (DIAN Real)</SelectItem>
                  <SelectItem value="sandbox">Pruebas / Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Regla de Redondeo Contable</Label>
              <Select value={billingRoundingMode} onValueChange={(v: any) => setBillingRoundingMode(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="two_decimals">2 Decimales (Estándar DIAN: ej. $2.104,10)</SelectItem>
                  <SelectItem value="nearest_integer">Entero más cercano (COP exacto: ej. $2.104)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Define cómo se redondea la tarifa unitaria calculada (total / kWh) para evitar descuadres de centavos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">N° Resolución DIAN (Referencia)</Label>
              <Input
                placeholder="1876400000123"
                value={resolutionNumber}
                onChange={(e) => setResolutionNumber(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Switch checked={autoInvoice} onCheckedChange={setAutoInvoice} id="auto-inv-switch" />
              <Label htmlFor="auto-inv-switch" className="text-xs cursor-pointer">
                Emitir factura automáticamente al finalizar recarga
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={autoSendEmail} onCheckedChange={setAutoSendEmail} id="auto-email-switch" />
              <Label htmlFor="auto-email-switch" className="text-xs cursor-pointer">
                Enviar PDF y XML al correo del usuario inmediatamente
              </Label>
            </div>
          </div>
        </div>

        {/* Webhook para confirmación DIAN */}
        <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-green-500" />
              <h4 className="text-xs font-semibold text-foreground">Webhook para Confirmación y Timbrado DIAN</h4>
            </div>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {config?.webhookConfiguredAt ? "Configurado" : "Disponible"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Alegra no tiene un campo visible en su panel web para registrar esta URL. Se vincula por API hacia el evento <code>invoices.emissionFinished</code> usando el Token de Proveedor Electrónico:
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input readOnly value={webhookUrl} className="h-8 text-xs font-mono bg-background" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast.success("URL copiada al portapapeles");
              }}
              className="h-8 gap-1 px-3 text-xs"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfigureWebhook}
              disabled={isConfiguringWebhook}
              className="h-8 gap-1 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              {isConfiguringWebhook ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Registrar Webhook por API
            </Button>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full sm:w-auto gap-1.5 text-xs"
          >
            {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-green-500" />}
            Probar Conexión con Proveedor
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs px-6"
          >
            {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Guardar Configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
