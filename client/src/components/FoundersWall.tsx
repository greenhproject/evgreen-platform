import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Gem, Award, Shield, Star, Sparkles, Quote } from "lucide-react";
import { motion } from "framer-motion";

const BADGE_CONFIG: Record<string, { label: string; icon: any; gradient: string }> = {
  emerald: { label: "Esmeralda", icon: Gem, gradient: "from-emerald-500 to-emerald-700" },
  gold: { label: "Oro", icon: Award, gradient: "from-yellow-400 to-amber-600" },
  platinum: { label: "Platino", icon: Shield, gradient: "from-slate-300 to-slate-500" },
  diamond: { label: "Diamante", icon: Star, gradient: "from-cyan-300 to-blue-500" },
};

export function FoundersWall() {
  const { data: founders, isLoading } = trpc.investorManagement.getFoundersWall.useQuery();

  if (isLoading) return null;
  if (!founders || founders.length === 0) return null;

  return (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-5 px-1">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Crown className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Muro de Fundadores</h3>
          <p className="text-xs text-muted-foreground">Quienes hicieron posible EVGreen</p>
        </div>
      </div>

      <div className="space-y-3">
        {founders.map((founder: any, index: number) => {
          const badgeInfo = founder.investorBadge ? BADGE_CONFIG[founder.investorBadge] : null;
          return (
            <motion.div
              key={founder.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative group"
            >
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/5 via-transparent to-transparent border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar con insignia */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12 ring-2 ring-amber-500/30 ring-offset-2 ring-offset-background">
                      <AvatarImage src={founder.investorPhotoUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-sm">
                        {founder.name?.charAt(0)?.toUpperCase() || "F"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{founder.name}</span>
                      {badgeInfo && (
                        <Badge className={`bg-gradient-to-r ${badgeInfo.gradient} text-white border-0 text-[10px] px-1.5 py-0`}>
                          <badgeInfo.icon className="w-2.5 h-2.5 mr-0.5" />
                          {badgeInfo.label}
                        </Badge>
                      )}
                    </div>
                    {founder.founderTitle && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        {founder.founderTitle}
                      </p>
                    )}
                    {founder.companyName && (
                      <p className="text-xs text-muted-foreground">{founder.companyName}</p>
                    )}
                    {founder.investorQuote && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <Quote className="w-3 h-3 text-amber-500/50 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                          {founder.investorQuote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
