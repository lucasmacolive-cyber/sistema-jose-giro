import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { BookOpen, KeyRound, Loader2, User, Info, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  login: z.string().min(1, "O login é obrigatório"),
  senha: z.string().min(1, "A senha é obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const [isHovering, setIsHovering] = useState(false);
  const [mostrarDica, setMostrarDica] = useState(false);
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "",
      senha: "",
    },
  });

  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.sucesso) {
          toast({
            title: "Acesso autorizado",
            description: `Bem-vindo, ${data.usuario?.nomeCompleto}`,
          });
          window.location.href = "/";
        } else {
          toast({
            variant: "destructive",
            title: "Erro de autenticação",
            description: data.mensagem || "Credenciais inválidas.",
          });
        }
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: (error as any).mensagem || "Não foi possível conectar ao servidor.",
        });
      }
    }
  });

  const onSubmit = (data: LoginForm) => {
    login({ data });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Visuals */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-card/30">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Abstract tech background" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
        
        <div className="relative z-20 flex flex-col justify-center px-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-primary/20 backdrop-blur-md border border-primary/20 mb-8 shadow-2xl shadow-primary/20">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-5xl font-display font-extrabold text-white leading-tight mb-4">
              Sistema de Gestão<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                E.M. José Giró Faísca
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-md">
              Acesso seguro e centralizado a todos os recursos administrativos, acadêmicos e operacionais da instituição.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-[500px] flex items-center justify-center p-8 relative">
        {/* Subtle ambient glow behind form */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
        
        <motion.div 
          className="w-full max-w-sm glass-panel p-10 rounded-3xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-10">
            {/* If the image isn't available, the BookOpen icon provides a nice fallback. But we have a logo via user. Let's use it as avatar fallback style or image */}
            <div className="mx-auto w-24 h-24 mb-6 rounded-2xl bg-gradient-to-br from-card to-background p-1 ring-1 ring-white/10 shadow-xl shadow-black/50 overflow-hidden flex items-center justify-center">
               <img 
                 src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" 
                 alt="Logo Escola" 
                 className="w-full h-full object-contain"
                 onError={(e) => {
                   e.currentTarget.style.display = 'none';
                 }}
               />
               <BookOpen className="absolute h-10 w-10 text-muted-foreground opacity-50 -z-10" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">Bem-vindo</h2>
            <p className="text-muted-foreground mt-2">Faça login com suas credenciais</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">Usuário / Matrícula</Label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="login"
                    placeholder="Digite seu login" 
                    className="pl-11 h-12 bg-black/20 border-white/10 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl text-base placeholder:text-muted-foreground/50 transition-all"
                    {...form.register("login")}
                  />
                </div>
                {form.formState.errors.login && (
                  <p className="text-sm text-destructive font-medium">{form.formState.errors.login.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  <button
                    type="button"
                    onClick={() => setMostrarDica((v) => !v)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Esqueceu a senha?
                  </button>
                </div>
                <AnimatePresence>
                  {mostrarDica && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                      className="relative p-4 rounded-xl border border-primary/25 bg-primary/10 text-sm space-y-2"
                    >
                      <button
                        type="button"
                        onClick={() => setMostrarDica(false)}
                        className="absolute top-2.5 right-2.5 text-white/30 hover:text-white/70 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <p className="font-semibold text-white">Como acessar o sistema:</p>
                      <div className="space-y-1.5 text-white/75">
                        <p>
                          <span className="font-medium text-white">Login:</span> sua <span className="text-primary font-semibold">matrícula</span> (ex: 12345)
                        </p>
                        <p>
                          <span className="font-medium text-white">Senha:</span> seu <span className="text-primary font-semibold">CPF</span>, somente os números, sem pontos ou traços (ex: 12345678900)
                        </p>
                      </div>
                      <p className="text-[0.7rem] text-white/40 pt-1">
                        Se ainda assim não conseguir entrar, procure a gestão da escola.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="relative group">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="senha"
                    type="password"
                    placeholder="••••••••" 
                    className="pl-11 h-12 bg-black/20 border-white/10 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl text-base placeholder:text-muted-foreground/50 transition-all"
                    {...form.register("senha")}
                  />
                </div>
                {form.formState.errors.senha && (
                  <p className="text-sm text-destructive font-medium">{form.formState.errors.senha.message}</p>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary hover:to-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:translate-y-0"
              disabled={isPending}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Acessar Sistema
                  <motion.span
                    animate={{ x: isHovering ? 4 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    →
                  </motion.span>
                </span>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
