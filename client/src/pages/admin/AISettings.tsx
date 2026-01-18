/**
 * Configuración de IA - Panel de Administración
 * Permite configurar el proveedor de IA, API keys y parámetros
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Bot,
  Settings,
  Key,
  Zap,
  Brain,
  MessageSquare,
  Map,
  TrendingUp,
  BarChart3,
  Shield,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

type AIProvider = "manus" | "openai" | "anthropic" | "google" | "azure" | "custom";

interface ProviderInfo {
  name: AIProvider;
  displayName: string;
  isConfigured: boolean;
  supportedModels: string[];
  defaultModel: string;
}

export default function AISettings() {
  const utils = trpc.useUtils();

  // Estado del formulario
  const [provider, setProvider] = useState<AIProvider>("manus");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [azureApiKey, setAzureApiKey] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [modelName, setModelName] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [enableChat, setEnableChat] = useState(true);
  const [enableRecommendations, setEnableRecommendations] = useState(true);
  const [enableTripPlanner, setEnableTripPlanner] = useState(true);
  const [enableInvestorInsights, setEnableInvestorInsights] = useState(true);
  const [enableAdminAnalytics, setEnableAdminAnalytics] = useState(true);
  const [dailyUserLimit, setDailyUserLimit] = useState(50);
  const [dailyTotalLimit, setDailyTotalLimit] = useState(10000);

  // Estado de UI
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Queries
  const { data: config, isLoading: configLoading } = trpc.ai.getConfig.useQuery();
  const { data: providers } = trpc.ai.getProviders.useQuery();

  // Mutations
  const updateConfig = trpc.ai.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada", {
        description: "Los cambios se aplicarán inmediatamente",
      });
      utils.ai.getConfig.invalidate();
    },
    onError: (error) => {
      toast.error("Error al guardar", {
        description: error.message,
      });
    },
  });

  const testProvider = trpc.ai.testProvider.useMutation({
    onSuccess: (result) => {
      setTestResult({
        success: result.success,
        message: result.success
          ? `Conexión exitosa. Modelo: ${result.model}`
          : result.error || "Error desconocido",
      });
      setTestingProvider(null);
    },
    onError: (error) => {
      setTestResult({
        success: false,
        message: error.message,
      });
      setTestingProvider(null);
    },
  });

  // Cargar configuración inicial
  useEffect(() => {
    if (config) {
      setProvider(config.activeProviderName as AIProvider);
      setTemperature(config.temperature || 0.7);
      setMaxTokens(config.maxTokens || 2000);
      setEnableChat(config.enableChat);
      setEnableRecommendations(config.enableRecommendations);
      setEnableTripPlanner(config.enableTripPlanner);
      setEnableInvestorInsights(config.enableInvestorInsights);
      setEnableAdminAnalytics(config.enableAdminAnalytics);
      setDailyUserLimit(config.dailyUserLimit || 50);
      setDailyTotalLimit(config.dailyTotalLimit || 10000);
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      provider,
      openaiApiKey: openaiApiKey || undefined,
      anthropicApiKey: anthropicApiKey || undefined,
      googleApiKey: googleApiKey || undefined,
      azureApiKey: azureApiKey || undefined,
      azureEndpoint: azureEndpoint || undefined,
      customApiKey: customApiKey || undefined,
      customEndpoint: customEndpoint || undefined,
      modelName: modelName || undefined,
      temperature,
      maxTokens,
      enableChat,
      enableRecommendations,
      enableTripPlanner,
      enableInvestorInsights,
      enableAdminAnalytics,
      dailyUserLimit,
      dailyTotalLimit,
    });
  };

  const handleTestProvider = (providerToTest: AIProvider) => {
    setTestingProvider(providerToTest);
    setTestResult(null);

    let apiKey: string | undefined;
    let endpoint: string | undefined;

    switch (providerToTest) {
      case "openai":
        apiKey = openaiApiKey;
        break;
      case "anthropic":
        apiKey = anthropicApiKey;
        break;
      case "google":
        apiKey = googleApiKey;
        break;
      case "azure":
        apiKey = azureApiKey;
        endpoint = azureEndpoint;
        break;
      case "custom":
        apiKey = customApiKey;
        endpoint = customEndpoint;
        break;
    }

    testProvider.mutate({
      provider: providerToTest,
      apiKey,
      endpoint,
      model: modelName || undefined,
    });
  };

  const getProviderIcon = (providerName: AIProvider) => {
    switch (providerName) {
      case "manus":
        return <Zap className="h-5 w-5 text-green-500" />;
      case "openai":
        return <Brain className="h-5 w-5 text-emerald-500" />;
      case "anthropic":
        return <Bot className="h-5 w-5 text-orange-500" />;
      case "google":
        return <Brain className="h-5 w-5 text-blue-500" />;
      case "azure":
        return <Brain className="h-5 w-5 text-cyan-500" />;
      case "custom":
        return <Settings className="h-5 w-5 text-purple-500" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getProviderModels = (providerName: AIProvider): string[] => {
    const providerInfo = providers?.find((p) => p.name === providerName);
    return providerInfo?.supportedModels || [];
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            Configuración de IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Configura el proveedor de IA, API keys y parámetros del asistente
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Guardar cambios
        </Button>
      </div>

      <Tabs defaultValue="provider" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="provider" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Proveedor
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Funciones
          </TabsTrigger>
          <TabsTrigger value="parameters" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Parámetros
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Límites
          </TabsTrigger>
        </TabsList>

        {/* Tab: Proveedor */}
        <TabsContent value="provider" className="space-y-6">
          {/* Información del proveedor actual */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Proveedor activo: {config?.activeProviderDisplayName}</AlertTitle>
            <AlertDescription>
              {config?.isConfigured ? (
                <span className="text-green-500 flex items-center gap-1">
                  <Check className="h-4 w-4" /> Configurado correctamente
                </span>
              ) : (
                <span className="text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Requiere configuración
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Selector de proveedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Seleccionar Proveedor de IA
              </CardTitle>
              <CardDescription>
                Elige el proveedor de IA que deseas utilizar. Manus LLM está incluido sin costo adicional.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {providers?.map((p: ProviderInfo) => (
                  <div
                    key={p.name}
                    onClick={() => setProvider(p.name)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      provider === p.name
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getProviderIcon(p.name)}
                      <div>
                        <p className="font-medium">{p.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.name === "manus" ? "Incluido" : "API Key requerida"}
                        </p>
                      </div>
                    </div>
                    {p.isConfigured && p.name !== "manus" && (
                      <Badge variant="outline" className="mt-2 text-green-500 border-green-500">
                        <Check className="h-3 w-3 mr-1" /> Configurado
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Configuración de API Keys */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Ingresa las credenciales para el proveedor seleccionado
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKeys(!showApiKeys)}
                >
                  {showApiKeys ? (
                    <EyeOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {showApiKeys ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {provider === "manus" && (
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertTitle>Manus LLM</AlertTitle>
                  <AlertDescription>
                    Este proveedor está incluido en la plataforma y no requiere configuración adicional.
                  </AlertDescription>
                </Alert>
              )}

              {provider === "openai" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <Input
                      id="openai-key"
                      type={showApiKeys ? "text" : "password"}
                      placeholder="sk-..."
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtén tu API key en{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        platform.openai.com
                      </a>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openai-model">Modelo</Label>
                    <Select value={modelName} onValueChange={setModelName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderModels("openai").map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {provider === "anthropic" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                    <Input
                      id="anthropic-key"
                      type={showApiKeys ? "text" : "password"}
                      placeholder="sk-ant-..."
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtén tu API key en{" "}
                      <a
                        href="https://console.anthropic.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        console.anthropic.com
                      </a>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anthropic-model">Modelo</Label>
                    <Select value={modelName} onValueChange={setModelName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderModels("anthropic").map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {provider === "google" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="google-key">Google AI API Key</Label>
                    <Input
                      id="google-key"
                      type={showApiKeys ? "text" : "password"}
                      placeholder="AIza..."
                      value={googleApiKey}
                      onChange={(e) => setGoogleApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtén tu API key en{" "}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        aistudio.google.com
                      </a>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-model">Modelo</Label>
                    <Select value={modelName} onValueChange={setModelName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderModels("google").map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {provider === "azure" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="azure-key">Azure OpenAI API Key</Label>
                    <Input
                      id="azure-key"
                      type={showApiKeys ? "text" : "password"}
                      placeholder="..."
                      value={azureApiKey}
                      onChange={(e) => setAzureApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="azure-endpoint">Azure Endpoint</Label>
                    <Input
                      id="azure-endpoint"
                      placeholder="https://your-resource.openai.azure.com/"
                      value={azureEndpoint}
                      onChange={(e) => setAzureEndpoint(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {provider === "custom" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-endpoint">Endpoint URL</Label>
                    <Input
                      id="custom-endpoint"
                      placeholder="https://api.example.com/v1/chat/completions"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-key">API Key</Label>
                    <Input
                      id="custom-key"
                      type={showApiKeys ? "text" : "password"}
                      placeholder="..."
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-model">Nombre del Modelo</Label>
                    <Input
                      id="custom-model"
                      placeholder="model-name"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Botón de prueba */}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Probar conexión</p>
                  <p className="text-sm text-muted-foreground">
                    Verifica que el proveedor esté configurado correctamente
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleTestProvider(provider)}
                  disabled={testingProvider !== null}
                >
                  {testingProvider === provider ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Probar
                </Button>
              </div>

              {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  <AlertTitle>{testResult.success ? "Conexión exitosa" : "Error de conexión"}</AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Funciones */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Funciones de IA</CardTitle>
              <CardDescription>
                Habilita o deshabilita las diferentes funcionalidades del asistente de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Chat Conversacional</p>
                    <p className="text-sm text-muted-foreground">
                      Permite a los usuarios chatear con el asistente de IA
                    </p>
                  </div>
                </div>
                <Switch checked={enableChat} onCheckedChange={setEnableChat} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">Recomendaciones de Carga</p>
                    <p className="text-sm text-muted-foreground">
                      Sugiere estaciones de carga basadas en ubicación y preferencias
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableRecommendations}
                  onCheckedChange={setEnableRecommendations}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Map className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Planificador de Viajes</p>
                    <p className="text-sm text-muted-foreground">
                      Planifica rutas con paradas de carga optimizadas
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableTripPlanner}
                  onCheckedChange={setEnableTripPlanner}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Insights para Inversionistas</p>
                    <p className="text-sm text-muted-foreground">
                      Análisis y recomendaciones para inversionistas
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableInvestorInsights}
                  onCheckedChange={setEnableInvestorInsights}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                  <div>
                    <p className="font-medium">Analytics para Administradores</p>
                    <p className="text-sm text-muted-foreground">
                      Análisis avanzados y detección de anomalías
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableAdminAnalytics}
                  onCheckedChange={setEnableAdminAnalytics}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Parámetros */}
        <TabsContent value="parameters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros del Modelo</CardTitle>
              <CardDescription>
                Ajusta los parámetros de generación del modelo de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Temperatura: {temperature.toFixed(2)}</Label>
                  <Badge variant="outline">
                    {temperature < 0.3
                      ? "Preciso"
                      : temperature < 0.7
                      ? "Balanceado"
                      : "Creativo"}
                  </Badge>
                </div>
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">
                  Valores más bajos producen respuestas más predecibles. Valores más altos
                  aumentan la creatividad.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Tokens máximos: {maxTokens}</Label>
                <Slider
                  value={[maxTokens]}
                  onValueChange={([v]) => setMaxTokens(v)}
                  min={100}
                  max={8000}
                  step={100}
                />
                <p className="text-xs text-muted-foreground">
                  Límite máximo de tokens en la respuesta. Más tokens permiten respuestas más
                  largas pero aumentan el costo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Límites */}
        <TabsContent value="limits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Límites de Uso</CardTitle>
              <CardDescription>
                Configura los límites diarios para controlar el uso y los costos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Límite diario por usuario: {dailyUserLimit} solicitudes</Label>
                <Slider
                  value={[dailyUserLimit]}
                  onValueChange={([v]) => setDailyUserLimit(v)}
                  min={10}
                  max={200}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Número máximo de solicitudes de IA que cada usuario puede hacer por día.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Límite diario total: {dailyTotalLimit.toLocaleString()} solicitudes</Label>
                <Slider
                  value={[dailyTotalLimit]}
                  onValueChange={([v]) => setDailyTotalLimit(v)}
                  min={1000}
                  max={100000}
                  step={1000}
                />
                <p className="text-xs text-muted-foreground">
                  Número máximo total de solicitudes de IA para toda la plataforma por día.
                </p>
              </div>

              <Separator />

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Protección de costos</AlertTitle>
                <AlertDescription>
                  Estos límites ayudan a controlar los costos de API cuando se usan proveedores
                  externos como OpenAI o Anthropic. El proveedor Manus LLM está incluido sin
                  límites adicionales.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
