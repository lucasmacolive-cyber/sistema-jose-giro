// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, BookOpen, UserCircle,
  Printer, FileText, Settings, LogOut, Loader2,
  Bell, FileX, ClipboardList, ChevronLeft, ChevronRight,
  Activity, Timer, Menu, X, NotebookPen, CalendarDays,
  Cake, GraduationCap, Briefcase, CheckCircle2, RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: BookOpen, label: "Turmas", href: "/turmas" },
  { icon: Users, label: "Perfil do Aluno", href: "/alunos" },
  { icon: NotebookPen, label: "Diários", href: "/diarios" },
  { icon: Activity, label: "Notas/Presenças", href: "/notas-presencas" },
  { icon: UserCircle, label: "Professores", href: "/professores" },
  { icon: UserCircle, label: "Funcionários", href: "/funcionarios" },
  { icon: Printer, label: "Impressões", href: "/impressoes" },
  { icon: FileText, label: "Documentos", href: "/documentos" },
  { icon: CalendarDays, label: "Calendário", href: "/calendario" },
  { icon: ClipboardList, label: "Listagens", href: "/listagens" },
  { icon: Timer, label: "Ponto", href: "/ponto" },
  { icon: FileX, label: "Arquivo Morto", href: "/arquivo-morto" },
  { icon: Settings, label: "Ajustes", href: "/sync" },
];

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function wmoInfo(code: number): { desc: string; emoji: string } {
  if (code === 0) return { desc: "Céu limpo", emoji: "☀️" };
  if (code <= 2) return { desc: "Poucas nuvens", emoji: "🌤️" };
  if (code === 3) return { desc: "Nublado", emoji: "☁️" };
  if (code <= 48) return { desc: "Nevoeiro", emoji: "🌫️" };
  if (code <= 57) return { desc: "Garoa", emoji: "🌦️" };
  if (code <= 67) return { desc: "Chuva", emoji: "🌧️" };
  if (code <= 77) return { desc: "Neve", emoji: "❄️" };
  if (code <= 82) return { desc: "Aguaceiros", emoji: "🌧️" };
  if (code === 95) return { desc: "Tempestade", emoji: "⛈️" };
  return { desc: "Tempestade c/ granizo", emoji: "⛈️" };
}

function iconeTipo(tipo: string) {
  if (tipo === "professor")   return <UserCircle className="h-3.5 w-3.5 text-violet-400 shrink-0" />;
  if (tipo === "funcionario") return <Briefcase  className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <GraduationCap className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
}

/* ─── Dropdown de notificações ───────────────────────────────────────────── */
function NotifPanel({ onClose }: { onClose: () => void }) {
  const [dados, setDados] = useState<{ hoje: any[]; semana: any[] } | null>(null);
  const [loadingAniv, setLoadingAniv] = useState(true);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [ficai, setFicai] = useState<{ threshold: number; alertas: any[] } | null>(null);
  const [loadingFicai, setLoadingFicai] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/aniversariantes`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setDados(d))
      .catch(() => setDados({ hoje: [], semana: [] }))
      .finally(() => setLoadingAniv(false));

    fetch(`${BASE}/api/diario/ficai`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setFicai(d))
      .catch(() => setFicai({ threshold: 3, alertas: [] }))
      .finally(() => setLoadingFicai(false));

    const raw = localStorage.getItem("suap_last_sync");
    if (raw) {
      try {
        const d = new Date(raw);
        setUltimaSync(d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
      } catch { /* ignore */ }
    }
  }, []);

  const hoje = dados?.hoje ?? [];
  const semana = (dados?.semana ?? []).filter((a: any) => a.diasAte > 0);
  const ficaiAlertas = ficai?.alertas ?? [];
  const totalNotif = hoje.length + (semana.length > 0 ? 1 : 0) + ficaiAlertas.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="absolute right-0 top-full mt-2 w-80 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
      style={{ maxHeight: "480px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="font-bold text-white text-sm">Notificações</span>
          {totalNotif > 0 && (
            <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {totalNotif}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>

        {/* Status do Sistema */}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Sistema</p>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Sistema operacional</p>
              <p className="text-[11px] text-slate-400">Todos os serviços online</p>
            </div>
          </div>
          {ultimaSync && (
            <div className="flex items-center gap-2.5 mt-2.5">
              <RefreshCw className="h-4 w-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Última sincronização SUAP</p>
                <p className="text-[11px] text-slate-400">{ultimaSync}</p>
              </div>
            </div>
          )}
          {!ultimaSync && (
            <div className="flex items-center gap-2.5 mt-2.5">
              <RefreshCw className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-300">Sincronização SUAP</p>
                <p className="text-[11px] text-slate-500">Nenhuma sincronização registrada</p>
              </div>
            </div>
          )}
        </div>

        {/* Alertas FICAI */}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-orange-400" />
            Alertas de Frequência (FICAI)
          </p>
          {loadingFicai && (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando...
            </div>
          )}
          {!loadingFicai && ficaiAlertas.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs py-1">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Nenhum aluno em situação de FICAI.</span>
            </div>
          )}
          {!loadingFicai && ficaiAlertas.slice(0, 5).map((a: any, i: number) => (
            <Link key={i} href={`/diario/${encodeURIComponent(a.turma)}`} onClick={onClose}>
              <div className="flex items-center gap-2.5 py-1.5 hover:bg-white/5 -mx-1 px-1 rounded-lg cursor-pointer transition-colors">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.nome}</p>
                  <p className="text-[11px] text-slate-400">{a.turma} · {(a.motivos ?? [a.maxConsecutivo + " consec."]).join(" / ")}</p>
                </div>
                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  FICAI
                </span>
              </div>
            </Link>
          ))}
          {ficaiAlertas.length > 5 && (
            <p className="text-xs text-slate-500 mt-1 text-center">+{ficaiAlertas.length - 5} outros</p>
          )}
        </div>

        {/* Aniversariantes hoje */}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            🎂 Aniversariantes Hoje
          </p>
          {loadingAniv && (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
            </div>
          )}
          {!loadingAniv && hoje.length === 0 && (
            <p className="text-xs text-slate-500 py-1">Nenhum aniversariante hoje.</p>
          )}
          {!loadingAniv && hoje.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5">
              <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <Cake className="h-3.5 w-3.5 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{a.nome}</p>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  {iconeTipo(a.tipo)}
                  <span>{a.info}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full shrink-0">Hoje!</span>
            </div>
          ))}
        </div>

        {/* Próximos desta semana */}
        {semana.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              📅 Esta Semana
            </p>
            {semana.slice(0, 5).map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5">
                <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  {iconeTipo(a.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.nome}</p>
                  <p className="text-[11px] text-slate-400">{a.info}</p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  em {a.diasAte}d
                </span>
              </div>
            ))}
            {semana.length > 5 && (
              <p className="text-xs text-slate-500 mt-1 text-center">+{semana.length - 5} outros esta semana</p>
            )}
          </div>
        )}

        {/* Sem nada */}
        {!loadingAniv && hoje.length === 0 && semana.length === 0 && (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-slate-500">Nenhum aniversariante esta semana.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Conteúdo da barra lateral ──────────────────────────────────────────── */
function NavContent({
  collapsed,
  user,
  isLoggingOut,
  logout,
  onNavigate,
}: {
  collapsed: boolean;
  user: { nomeCompleto: string; perfil: string };
  isLoggingOut: boolean;
  logout: () => void;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();

  return (
    <>
      {/* Logo — clique para forçar atualização do sistema */}
      <div className={cn("flex items-center gap-3 p-4 pb-5 border-b border-white/5", collapsed && "justify-center")}>
        <button
          onClick={() => window.location.reload()}
          title="Clique para atualizar o sistema"
          className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 overflow-hidden hover:opacity-80 active:scale-95 transition-all cursor-pointer"
        >
          <img src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" alt="Logo" className="h-7 w-7 object-contain" />
        </button>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-display font-bold leading-tight whitespace-nowrap">E.M. José Giró</h1>
            <p className="text-[0.6rem] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">
              Sistema Escolar
            </p>
            <p className="text-[0.55rem] text-white/20 font-mono whitespace-nowrap">v1.1.0</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location === item.href ||
            (location.startsWith(item.href) && item.href !== "/");
          return (
            <Link key={item.href} href={item.href} className="block" onClick={onNavigate}>
              <div
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                />
                {!collapsed && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}
                {isActive && !collapsed && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Usuário */}
      <div
        className={cn(
          "p-4 border-t border-white/5 bg-black/20",
          collapsed ? "flex flex-col items-center gap-3" : ""
        )}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                  {user.nomeCompleto.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">{user.nomeCompleto}</p>
                <p className="text-xs text-primary truncate">{user.perfil}</p>
              </div>
            </div>
            <Button
              variant="destructive"
              className="w-full justify-start gap-2 shadow-none bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sair do Sistema
            </Button>
          </>
        ) : (
          <>
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                {user.nomeCompleto.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => logout()}
              title="Sair"
              className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>
    </>
  );
}

/* ─── Layout principal ───────────────────────────────────────────────────── */
export function AppLayout({ children, noPadding }: { children: React.ReactNode; noPadding?: boolean }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe({
    query: { retry: false, refetchOnWindowFocus: false },
  } as any);
  const { mutate: logout, isPending: isLoggingOut } = useLogout({
    mutation: { onSuccess: () => { window.location.href = "/login"; } },
  });

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; desc: string; emoji: string } | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);

  // Fechar notificações ao clicar fora
  useEffect(() => {
    if (!notifOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-21.7454&longitude=-41.3247&current=temperature_2m,weather_code&timezone=America/Sao_Paulo"
    )
      .then((r) => r.json())
      .then((d) => {
        const temp = Math.round(d.current.temperature_2m);
        const { desc, emoji } = wmoInfo(d.current.weather_code);
        setWeather({ temp, desc, emoji });
      })
      .catch(() => {});
  }, []);

  // Fechar drawer ao navegar
  useEffect(() => { setDrawerOpen(false); }, [location]);

  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dayStr = DIAS[now.getDay()];

  // Mostrar seta de voltar em todas as páginas exceto o dashboard "/"
  const showBackButton = location !== "/";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── DESKTOP: Sidebar lateral ─────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative border-r border-white/5 bg-card/40 backdrop-blur-xl flex-col shrink-0 overflow-hidden hidden md:flex"
      >
        {/* Botão colapsar */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-7 z-20 bg-primary rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-primary/30 border border-white/20 hover:brightness-110 transition-all"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-white" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-white" />
          )}
        </button>

        <NavContent
          collapsed={collapsed}
          user={user}
          isLoggingOut={isLoggingOut}
          logout={logout}
        />
      </motion.aside>

      {/* ── MOBILE: Drawer overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-white/5 bg-card/95 backdrop-blur-xl md:hidden"
            >
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white z-10"
              >
                <X className="h-5 w-5" />
              </button>
              <NavContent
                collapsed={false}
                user={user}
                isLoggingOut={isLoggingOut}
                logout={logout}
                onNavigate={() => setDrawerOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Área principal ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* Header */}
        <header className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 border-b border-white/5 bg-background/80 backdrop-blur-md z-10 gap-3 shrink-0">

          {/* Esquerda: hamburger (mobile) + voltar + logo */}
          <div className="flex items-center gap-2 md:gap-3">

            {/* Hamburger — só mobile */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Botão voltar — em todas as páginas exceto dashboard */}
            <AnimatePresence>
              {showBackButton && (
                <motion.button
                  key="back-btn"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => window.history.back()}
                  title="Voltar"
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors shrink-0"
                >
                  <ChevronLeft className="h-5 w-5 text-white/70" />
                </motion.button>
              )}
            </AnimatePresence>

            <div className="h-8 w-8 md:h-9 md:w-9 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 overflow-hidden">
              <img src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" alt="Logo" className="h-6 w-6 md:h-7 md:w-7 object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-tight">E. M. José Giró Faísca</p>
              <p className="text-[0.6rem] text-muted-foreground uppercase tracking-wider hidden md:block">
                Campos dos Goytacazes · RJ
              </p>
            </div>
          </div>

          {/* Direita: data + tempo + sino */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex flex-col items-end">
              <p className="text-sm font-semibold text-white">{dayStr}</p>
              <p className="text-xs text-muted-foreground">{dateStr}</p>
            </div>

            {weather && (
              <div className="flex items-center gap-1.5 md:gap-2 bg-white/5 px-2 md:px-3 py-1 md:py-1.5 rounded-xl border border-white/10">
                <span className="text-base md:text-lg leading-none">{weather.emoji}</span>
                <div>
                  <p className="text-xs md:text-sm font-bold text-white leading-tight">{weather.temp}°C</p>
                  <p className="hidden md:block text-[0.6rem] text-muted-foreground leading-tight">{weather.desc}</p>
                </div>
              </div>
            )}

            {/* Sino — funcional */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className={cn(
                  "relative p-1.5 md:p-2 rounded-full transition-colors",
                  notifOpen ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-muted-foreground"
                )}
              >
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-primary ring-2 ring-background" />
              </button>

              <AnimatePresence>
                {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <div className={cn("flex-1 z-0", noPadding ? "overflow-hidden" : "overflow-auto p-4 md:p-8")}>
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={noPadding ? "h-full" : "max-w-7xl mx-auto h-full"}
          >
            {children}
          </motion.div>
        </div>

        {/* Glow effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      </main>
    </div>
  );
}
