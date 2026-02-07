// src/components/AchievementUnlockedModal.tsx
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface AchievementUnlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: {
    title: string;
    description: string;
    code: string;
    xp_reward: number;
  } | null;
}

export default function AchievementUnlockedModal({
  isOpen,
  onClose,
  achievement,
}: AchievementUnlockedModalProps) {
  const [animationStage, setAnimationStage] = useState<"enter" | "show" | "exit">("enter");

  useEffect(() => {
    if (isOpen && achievement) {
      // Animación de entrada
      setAnimationStage("enter");

      // Después de la animación de entrada, mostrar
      const showTimer = setTimeout(() => {
        setAnimationStage("show");

        // Lanzar confeti cuando se muestra el logro (optimizado)
        const colors = ["#fbbf24", "#f59e0b", "#8b5cf6", "#a855f7", "#ec4899"];

        // Explosión inicial desde ambos lados
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.8 },
          colors: colors,
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.8 },
          colors: colors,
        });

        // Segunda explosión después de 300ms
        setTimeout(() => {
          confetti({
            particleCount: 30,
            angle: 90,
            spread: 100,
            origin: { x: 0.5, y: 0.6 },
            colors: colors,
          });
        }, 300);
      }, 100);

      // Auto-cerrar después de 4 segundos
      const closeTimer = setTimeout(() => {
        setAnimationStage("exit");
        setTimeout(onClose, 500);
      }, 4000);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen, achievement, onClose]);

  if (!isOpen || !achievement) return null;

  // Ruta de la imagen del logro
  const imageSrc = `/achievements/${achievement.code}.png`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Overlay con blur */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 pointer-events-auto ${
          animationStage === "exit" ? "opacity-0" : "opacity-100"
        }`}
        onClick={() => {
          setAnimationStage("exit");
          setTimeout(onClose, 500);
        }}
      />

      {/* Modal */}
      <div
        className={`relative pointer-events-auto transition-all duration-500 ease-out ${
          animationStage === "enter"
            ? "scale-0 opacity-0"
            : animationStage === "show"
            ? "scale-100 opacity-100"
            : "scale-75 opacity-0 translate-y-10"
        }`}
      >
        {/* Partículas de brillo */}
        <div className="absolute inset-0 -z-10">
          <Sparkles
            className="absolute -top-8 -left-8 text-yellow-400 animate-pulse"
            size={32}
          />
          <Sparkles
            className="absolute -top-6 -right-6 text-yellow-300 animate-pulse delay-100"
            size={24}
          />
          <Sparkles
            className="absolute -bottom-6 -left-6 text-yellow-400 animate-pulse delay-200"
            size={28}
          />
          <Sparkles
            className="absolute -bottom-8 -right-8 text-yellow-300 animate-pulse delay-300"
            size={20}
          />
        </div>

        {/* Contenido */}
        <div className="bg-gradient-to-b from-violet-600 via-purple-600 to-indigo-700 rounded-3xl p-6 shadow-2xl max-w-[320px] text-center relative overflow-hidden">
          {/* Efectos de brillo de fondo */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/20 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse delay-500" />
          </div>

          {/* Botón cerrar */}
          <button
            onClick={() => {
              setAnimationStage("exit");
              setTimeout(onClose, 500);
            }}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition text-white"
          >
            <X size={18} />
          </button>

          {/* Título */}
          <p className="text-white/80 text-sm font-semibold mb-2 relative">
            🎉 ¡Logro Desbloqueado!
          </p>

          {/* Imagen del logro con animación */}
          <div className="relative mx-auto w-32 h-32 mb-4">
            {/* Anillo giratorio */}
            <div className="absolute inset-0 rounded-full border-4 border-dashed border-yellow-400/50 animate-spin-slow" />

            {/* Imagen */}
            <div className="absolute inset-2 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
              <img
                src={imageSrc}
                alt={achievement.title}
                className="w-full h-full object-contain p-2 animate-bounce-slow"
                onError={(e) => {
                  // Si no existe la imagen, mostrar icono genérico
                  (e.target as HTMLImageElement).src = "/achievements/default.png";
                }}
              />
            </div>

            {/* Brillo central */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent rounded-full animate-pulse" />
          </div>

          {/* Nombre del logro */}
          <h2 className="text-white text-xl font-extrabold mb-1 relative">
            {achievement.title}
          </h2>

          {/* Descripción */}
          <p className="text-white/70 text-sm mb-4 relative">
            {achievement.description}
          </p>

          {/* XP ganado */}
          {achievement.xp_reward > 0 && (
            <div className="inline-flex items-center gap-2 bg-yellow-400/20 px-4 py-2 rounded-full relative">
              <span className="text-yellow-300 font-extrabold text-lg">
                +{achievement.xp_reward} XP
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
