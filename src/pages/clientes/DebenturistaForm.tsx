import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { PdfViewer } from "@/components/PdfViewer";
import { maskCurrency, unmaskCurrency, maskDocumento, maskCEP, maskPhone } from "@/lib/simulador/formatters";

type Form = {
  tipo: 'PF' | 'PJ';
  nome: string;
  data_nascimento: string;
  estado_civil: string;
  documento: string;
  rg: string;
  orgao_emissor: string;
  data_emissao_rg: string;
  email: string;
  telefone: string;
  cep: string;
  cidade: string;
  estado: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  empregador: string;
  profissao: string;
  renda: string;
};

const empty: Form = {
  tipo: 'PF', nome: "", data_nascimento: "", estado_civil: "", documento: "", rg: "", orgao_emissor: "",
  data_emissao_rg: "", email: "", telefone: "", cep: "", cidade: "", estado: "", bairro: "",
  rua: "", numero: "", complemento: "", empregador: "", profissao: "", renda: "",
};

type FileKey = "comprovante_cpf" | "comprovante_rg" | "comprovante_endereco" | "comprovante_renda" | "anexo_investidor_profissional" | "termo_assinado";

export default function DebenturistaForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(empty);
  const [files, setFiles] = useState<Record<FileKey, File | null>>({
    comprovante_cpf: null, comprovante_rg: null, comprovante_endereco: null, comprovante_renda: null, anexo_investidor_profissional: null, termo_assinado: null,
  });
  const [existingPaths, setExistingPaths] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("debenturistas").select("*").eq("id", id).maybeSingle();
      if (error || !data) return;
      setForm({
        tipo: (data.tipo as 'PF' | 'PJ') ?? 'PF',
        nome: data.nome ?? "", data_nascimento: data.data_nascimento ?? "", estado_civil: data.estado_civil ?? "",
        documento: data.documento ?? "", rg: data.rg ?? "", orgao_emissor: data.orgao_emissor ?? "",
        data_emissao_rg: data.data_emissao_rg ?? "", email: data.email ?? "", telefone: data.telefone ?? "",
        cep: data.cep ?? "", cidade: data.cidade ?? "", estado: data.estado ?? "", bairro: data.bairro ?? "",
        rua: data.rua ?? "", numero: data.numero ?? "", complemento: data.complemento ?? "",
        empregador: data.empregador ?? "", profissao: data.profissao ?? "", renda: data.renda ? maskCurrency(Math.round(data.renda * 100).toString()) : "",
      });
      setExistingPaths({
        comprovante_cpf: data.comprovante_cpf_path,
        comprovante_rg: data.comprovante_rg_path,
        comprovante_endereco: data.comprovante_endereco_path,
        comprovante_renda: data.comprovante_renda_path,
        anexo_investidor_profissional: data.anexo_investidor_profissional_path,
        termo_assinado: data.termo_assinado_path,
      });
    })();
  }, [id]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setDocumento = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, documento: maskDocumento(e.target.value) }));
  const setCEP = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, cep: maskCEP(e.target.value) }));
  const setTelefone = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, telefone: maskPhone(e.target.value) }));
  const setRenda = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, renda: maskCurrency(e.target.value) }));
  const setFile = (k: FileKey) => (e: React.ChangeEvent<HTMLInputElement>) => setFiles(p => ({ ...p, [k]: e.target.files?.[0] ?? null }));


  const [buscandoCep, setBuscandoCep] = useState(false);
  const buscarCep = async (cepRaw: string) => {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      if (!res.ok) throw new Error("CEP não encontrado");
      const data = await res.json();
      setForm(p => ({
        ...p,
        cidade: data.city ?? p.cidade,
        estado: data.state ?? p.estado,
        bairro: data.neighborhood ?? p.bairro,
        rua: data.street ?? p.rua,
      }));
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar CEP");
    } finally {
      setBuscandoCep(false);
    }
  };

  const uploadFile = async (key: FileKey, debId: string): Promise<string | null> => {
    const f = files[key];
    if (!f) return existingPaths[key] ?? null;
    const ext = f.name.split(".").pop();
    const path = `${debId}/${key}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("documentos-debenturistas").upload(path, f);
    if (error) throw error;
    return path;
  };

  const handleSubmit = async (criarOutro = false) => {
    if (!form.nome.trim()) return toast.error(t("debenturistaForm.nameRequired"));
    setSalvando(true);
    try {
      const payload: any = {
        tipo: form.tipo,
        nome: form.nome.trim(),
        documento: form.documento || null,
        email: form.email || null,
        telefone: form.telefone || null,
        data_nascimento: form.tipo === 'PF' ? (form.data_nascimento || null) : null,
        estado_civil: form.tipo === 'PF' ? (form.estado_civil || null) : null,
        rg: form.tipo === 'PF' ? (form.rg || null) : null,
        orgao_emissor: form.tipo === 'PF' ? (form.orgao_emissor || null) : null,
        data_emissao_rg: form.tipo === 'PF' ? (form.data_emissao_rg || null) : null,
        cep: form.cep || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        bairro: form.bairro || null,
        rua: form.rua || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        empregador: form.tipo === 'PF' ? (form.empregador || null) : null,
        profissao: form.tipo === 'PF' ? (form.profissao || null) : null,
        renda: form.tipo === 'PF' && form.renda ? unmaskCurrency(form.renda) : null,
      };

      let debId = id;
      if (isEdit) {
        const { error } = await supabase.from("debenturistas").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("debenturistas").insert(payload).select("id").single();
        if (error) throw error;
        debId = data.id;
      }

      const paths = {
        comprovante_cpf_path: await uploadFile("comprovante_cpf", debId!),
        comprovante_rg_path: await uploadFile("comprovante_rg", debId!),
        comprovante_endereco_path: await uploadFile("comprovante_endereco", debId!),
        comprovante_renda_path: await uploadFile("comprovante_renda", debId!),
        anexo_investidor_profissional_path: await uploadFile("anexo_investidor_profissional", debId!),
        termo_assinado_path: await uploadFile("termo_assinado", debId!),
      };
      const { error: e2 } = await supabase.from("debenturistas").update(paths).eq("id", debId!);
      if (e2) throw e2;
      setExistingPaths({
        comprovante_cpf: paths.comprovante_cpf_path,
        comprovante_rg: paths.comprovante_rg_path,
        comprovante_endereco: paths.comprovante_endereco_path,
        comprovante_renda: paths.comprovante_renda_path,
        anexo_investidor_profissional: paths.anexo_investidor_profissional_path,
        termo_assinado: paths.termo_assinado_path,
      });
      setFiles({ comprovante_cpf: null, comprovante_rg: null, comprovante_endereco: null, comprovante_renda: null, anexo_investidor_profissional: null, termo_assinado: null });

      toast.success(isEdit ? t("debenturistaForm.saved") : t("debenturistaForm.created"));
      if (criarOutro) {
        setForm(empty);
        setFiles({ comprovante_cpf: null, comprovante_rg: null, comprovante_endereco: null, comprovante_renda: null, anexo_investidor_profissional: null, termo_assinado: null });
      } else {
        navigate("/clientes/debenturistas");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("debenturistaForm.saveError"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/clientes/debenturistas" className="hover:text-foreground">{t("debenturistaForm.crumb")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? t("debenturistaForm.crumbEdit") : t("debenturistaForm.crumbCreate")}</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? t("debenturistaForm.titleEdit") : t("debenturistaForm.titleCreate")}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("debenturistaForm.tipo")}</Label>
          <Select value={form.tipo} onValueChange={(v) => {
            const newTipo = v as 'PF' | 'PJ';
            setForm(p => ({ 
              ...p, 
              tipo: newTipo,
              documento: maskDocumento(p.documento)
            }));
          }}>

            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PF">{t("debenturistaForm.typePF")}</SelectItem>
              <SelectItem value="PJ">{t("debenturistaForm.typePJ")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Section title={t("debenturistaForm.secInfo")}>
        {form.tipo === 'PF' ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("debenturistaForm.fullName")} required><Input value={form.nome} onChange={set("nome")} /></Field>
            <Field label={t("debenturistaForm.birthDate")}><Input type="date" value={form.data_nascimento} onChange={set("data_nascimento")} /></Field>
            <Field label={t("debenturistaForm.maritalStatus")}><Input value={form.estado_civil} onChange={set("estado_civil")} /></Field>
            <Field label={t("debenturistaForm.cpf")}><Input value={form.documento} onChange={setDocumento} placeholder="000.000.000-00" /></Field>
            <Field label={t("debenturistaForm.rg")}><Input value={form.rg} onChange={set("rg")} /></Field>
            <Field label={t("debenturistaForm.issuingAgency")}><Input value={form.orgao_emissor} onChange={set("orgao_emissor")} /></Field>
            <Field label={t("debenturistaForm.issueDate")}><Input type="date" value={form.data_emissao_rg} onChange={set("data_emissao_rg")} /></Field>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("fields.razaoSocial")} required><Input value={form.nome} onChange={set("nome")} /></Field>
            <Field label={t("fields.cnpj")}><Input value={form.documento} onChange={setDocumento} placeholder="00.000.000/0000-00" /></Field>
          </div>
        )}
      </Section>

      <Section title={t("debenturistaForm.secContact")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("debenturistaForm.email")}><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label={t("debenturistaForm.phone")}><Input value={form.telefone} onChange={setTelefone} placeholder="(00) 00000-0000" /></Field>
        </div>
      </Section>

      <Section title={t("debenturistaForm.secAddress")}>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label={t("debenturistaForm.zip")}><Input value={form.cep} onChange={setCEP} onBlur={(e) => buscarCep(e.target.value)} disabled={buscandoCep} placeholder="00000-000" /></Field>
          <Field label={t("debenturistaForm.city")}><Input value={form.cidade} onChange={set("cidade")} /></Field>
          <Field label={t("debenturistaForm.state")}><Input value={form.estado} onChange={set("estado")} /></Field>
          <Field label={t("debenturistaForm.neighborhood")}><Input value={form.bairro} onChange={set("bairro")} /></Field>
          <Field label={t("debenturistaForm.street")} className="md:col-span-2"><Input value={form.rua} onChange={set("rua")} /></Field>
          <Field label={t("debenturistaForm.number")}><Input value={form.numero} onChange={set("numero")} /></Field>
          <Field label={t("debenturistaForm.complement")}><Input value={form.complemento} onChange={set("complemento")} /></Field>
        </div>
      </Section>

      {form.tipo === 'PF' && (
        <Section title={t("debenturistaForm.secProfession")}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("debenturistaForm.employer")}><Input value={form.empregador} onChange={set("empregador")} /></Field>
            <Field label={t("debenturistaForm.profession")}><Input value={form.profissao} onChange={set("profissao")} /></Field>
            <Field label={t("debenturistaForm.income")}><Input type="text" inputMode="decimal" value={form.renda} onChange={setRenda} placeholder="0,00" /></Field>
          </div>
        </Section>
      )}

      <Section title={t("debenturistaForm.secDocs")}>
        <div className="space-y-4">
          <FileField label={t("debenturistaForm.docCpf")} file={files.comprovante_cpf} existing={existingPaths.comprovante_cpf} onChange={setFile("comprovante_cpf")} />
          <FileField label={t("debenturistaForm.docRg")} file={files.comprovante_rg} existing={existingPaths.comprovante_rg} onChange={setFile("comprovante_rg")} />
          <FileField label={t("debenturistaForm.docAddress")} file={files.comprovante_endereco} existing={existingPaths.comprovante_endereco} onChange={setFile("comprovante_endereco")} />
          <FileField label={t("debenturistaForm.docIncome")} file={files.comprovante_renda} existing={existingPaths.comprovante_renda} onChange={setFile("comprovante_renda")} />
          <FileField label={t("debenturistaForm.docPro")} required file={files.anexo_investidor_profissional} existing={existingPaths.anexo_investidor_profissional} onChange={setFile("anexo_investidor_profissional")} />
          <FileField label={t("debenturistaForm.docSignedTerm")} file={files.termo_assinado} existing={existingPaths.termo_assinado} onChange={setFile("termo_assinado")} />
        </div>
      </Section>

      <div className="flex gap-2">
        <Button onClick={() => handleSubmit(false)} disabled={salvando}>{isEdit ? t("debenturistaForm.save") : t("debenturistaForm.create")}</Button>
        {!isEdit && <Button variant="outline" onClick={() => handleSubmit(true)} disabled={salvando}>{t("debenturistaForm.saveAndNew")}</Button>}
        <Button variant="outline" onClick={() => navigate("/clientes/debenturistas")}>{t("debenturistaForm.cancel")}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

function FileField({ label, required, file, existing, onChange }: { label: string; required?: boolean; file: File | null; existing: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"pdf" | "image" | "other">("other");

  const handleDownload = async (fileUrl: string, name: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      window.open(fileUrl, "_blank");
    }
  };

  const abrir = async () => {
    let blobUrl: string | null = null;
    let ext = "";
    if (file) {
      ext = file.name.split(".").pop()?.toLowerCase() || "";
      blobUrl = URL.createObjectURL(file);
    } else if (existing) {
      ext = existing.split(".").pop()?.toLowerCase() || "";
      const { data, error } = await supabase.storage.from("documentos-debenturistas").createSignedUrl(existing, 60);
      if (error || !data) return toast.error(error?.message || "Erro ao abrir arquivo");
      blobUrl = data.signedUrl;
    }
    if (!blobUrl) return;
    setTipo(ext === "pdf" ? "pdf" : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "image" : "other");
    setUrl(blobUrl);
    setOpen(true);
  };

  const temArquivo = !!file || !!existing;

  return (
    <div className="space-y-1.5">
      <div className="flex items-stretch gap-2">
        <label className="flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground hover:bg-muted/30">
          <span className="text-center font-medium text-foreground">{label} {required && <span className="text-destructive">*</span>}</span>
          <Upload className="h-4 w-4" />
          {file ? file.name : existing ? <span>{t("debenturistaForm.fileUploaded")} · <span className="text-primary">{t("debenturistaForm.replace")}</span></span> : <span>{t("debenturistaForm.dragOrClick")} <span className="text-primary">{t("debenturistaForm.clickHere")}</span></span>}
          <input type="file" className="hidden" onChange={onChange} />
        </label>
        {temArquivo && (
          <Button type="button" variant="outline" size="sm" className="self-center gap-1" onClick={abrir}>
            <Eye className="h-3.5 w-3.5" /> Visualizar
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && url) { URL.revokeObjectURL(url); setUrl(null); } }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-4">
            {url && tipo === "pdf" && <PdfViewer url={url} fileName={label.replace(/\s+/g, '_') + '.pdf'} />}
            {url && tipo === "image" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex w-full justify-end">
                  <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleDownload(url, label.replace(/\s+/g, '_') + '.png')}>
                    <Upload className="h-3.5 w-3.5 rotate-180" />
                    Baixar imagem
                  </Button>
                </div>
                <img src={url} alt={label} className="max-w-full max-h-full mx-auto rounded border border-border" />
              </div>
            )}
            {url && tipo === "other" && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-sm text-muted-foreground">
                Tipo de arquivo não suportado para pré-visualização.
                <Button variant="outline" onClick={() => handleDownload(url, label.replace(/\s+/g, '_'))}>
                  Baixar arquivo
                </Button>
              </div>
            )}

          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
}
