import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default function Parametros() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useState<any[]>([]);

  useEffect(() => {
    fetchParams();
  }, []);

  async function fetchParams() {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_parameters")
      .select("*")
      .order("key");
    
    if (error) {
      toast.error("Erro ao carregar parâmetros");
    } else {
      setParams(data || []);
    }
    setLoading(false);
  }

  const handleUpdate = (id: string, value: string) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, value } : p));
  };

  async function handleSave() {
    setSaving(true);
    try {
      for (const p of params) {
        const { error } = await supabase
          .from("app_parameters")
          .update({ value: p.value })
          .eq("id", p.id);
        
        if (error) throw error;
      }
      toast.success("Parâmetros atualizados com sucesso");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const termoUnico = params.find(p => p.key === "termo_investidor_qualificado");
  const termoLegacy = params.filter(p => p.key.startsWith("termo_investimento_"));
  const outros = params.filter(p => 
    p.key !== "termo_investidor_qualificado" && !p.key.startsWith("termo_investimento_")
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pages.parametros")}</h1>
          <p className="text-sm text-muted-foreground">Configure as informações gerais do sistema.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </Button>
      </div>

      {termoUnico && (
        <Card>
          <CardHeader>
            <CardTitle>Termo de Investidor Qualificado</CardTitle>
            <CardDescription>
              Edite o conteúdo do termo gerado em PDF. Use os marcadores{" "}
              <code className="text-xs bg-muted px-1 rounded">{`{{nome}}`}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{`{{cpf}}`}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{`{{endereco}}`}</code>{" "}
              e <code className="text-xs bg-muted px-1 rounded">{`{{data}}`}</code> para inserir
              dados dinâmicos. Use{" "}
              <code className="text-xs bg-muted px-1 rounded">[SECTION]Título[/SECTION]</code>{" "}
              para criar subtítulos. Separe parágrafos com linhas em branco.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={termoUnico.value} 
              onChange={(e) => handleUpdate(termoUnico.id, e.target.value)}
              className="min-h-[500px] text-sm leading-relaxed font-mono"
              placeholder="Conteúdo do termo..."
            />
          </CardContent>
        </Card>
      )}

      {termoLegacy.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Termo de Adesão (Antigo)</CardTitle>
            <CardDescription>
              Seções antigas, não utilizadas atualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {termoLegacy.map(p => (
              <div key={p.id} className="space-y-2">
                <Label className="capitalize font-semibold text-muted-foreground">
                  {p.key.replace("termo_investimento_", "").replace(/_/g, " ")}
                </Label>
                <Textarea 
                  value={p.value} 
                  onChange={(e) => handleUpdate(p.id, e.target.value)}
                  className="min-h-[80px] text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {outros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outros Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {outros.map(p => (
              <div key={p.id} className="space-y-2">
                <Label className="font-semibold">{p.key}</Label>
                <Textarea 
                  value={p.value} 
                  onChange={(e) => handleUpdate(p.id, e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
