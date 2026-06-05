import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import appAndroid from "@/assets/app-android.png";
import appIos from "@/assets/app-ios.png";
import aureaLogo from "@/assets/aurea-logo.png.asset.json";

function formatLastUpdate(date: Date, lang: string) {
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  };
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR", options).format(date);
}


export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    async function fetchLastUpdate() {
      const { data, error } = await supabase
        .from("cdi_diario")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.updated_at) {
        setLastUpdate(formatLastUpdate(new Date(data.updated_at), i18n.language));
      }
    }
    fetchLastUpdate();
  }, [i18n.language]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailSchema = z.string().trim().email(t("auth.invalidEmail")).max(255);
    const passwordSchema = z.string().min(8, t("auth.minPassword")).max(72);
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.errors[0].message);
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("common.welcome"));
    navigate("/", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-start justify-center bg-gradient-subtle p-4 pt-6">
      <div className="w-full max-w-sm">

        <Card className="border-border/60 shadow-elegant">
          <CardHeader className="text-center pt-4 pb-2">
            <CardTitle className="text-2xl">{t("auth.access")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t("auth.email")}</Label>
                <Input id="login-email" type="email" className="h-8" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t("auth.password")}</Label>
                <Input id="login-password" type="password" className="h-8" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("auth.login")}
              </Button>
              <div className="flex items-center justify-center gap-4 pt-2">
                {[
                  { value: "pt", code: "br", label: "Português" },
                  { value: "en", code: "us", label: "English" },
                  { value: "es", code: "es", label: "Español" },
                ].map((l) => {
                  const active = (i18n.resolvedLanguage || i18n.language || "pt") === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      aria-label={l.label}
                      onClick={() => i18n.changeLanguage(l.value)}
                      className={`transition-opacity ${active ? "opacity-100" : "opacity-50 hover:opacity-90"}`}
                    >
                      <img
                        src={`https://flagcdn.com/w40/${l.code}.png`}
                        srcSet={`https://flagcdn.com/w80/${l.code}.png 2x`}
                        alt={l.label}
                        className="h-4 w-[22px] rounded-sm object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 sm:left-1/2 max-sm:left-3 max-sm:translate-x-0">
        <a href="#" aria-label="App iOS" className="opacity-90 transition-opacity hover:opacity-100">
          <img src={appIos} alt="App iOS" className="h-7 w-auto" />
        </a>
        <a href="#" aria-label="App Android" className="opacity-90 transition-opacity hover:opacity-100">
          <img src={appAndroid} alt="App Android" className="h-7 w-auto" />
        </a>
      </div>


      {lastUpdate && (
        <div className="fixed bottom-3 left-6 max-sm:left-3">
          <span className="text-[9px] text-muted-foreground">
            {t("auth.lastSystemUpdate")}: {lastUpdate}
          </span>
        </div>
      )}
    </div>
  );
}
