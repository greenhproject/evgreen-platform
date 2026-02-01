/**
 * Hook para reproducir sonidos de notificación
 * Usa Web Audio API para generar sonidos de éxito sin necesidad de archivos externos
 */

import { useCallback, useRef } from "react";

// Contexto de audio compartido
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function useNotificationSound() {
  const isPlayingRef = useRef(false);

  /**
   * Reproduce un sonido de éxito/celebración
   * Genera un sonido de "ding" agradable usando síntesis de audio
   */
  const playSuccessSound = useCallback(() => {
    if (isPlayingRef.current) return;
    
    try {
      const ctx = getAudioContext();
      
      // Resumir el contexto si está suspendido (requerido en algunos navegadores)
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      isPlayingRef.current = true;
      const now = ctx.currentTime;
      
      // Crear oscilador principal (nota fundamental)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // A6
      
      // Crear segundo oscilador (armónico)
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, now); // E6
      osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.15); // E7
      
      // Crear tercer oscilador para el "brillo"
      const osc3 = ctx.createOscillator();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(1760, now + 0.05); // A6
      osc3.frequency.exponentialRampToValueAtTime(2200, now + 0.2); // C#7
      
      // Crear nodos de ganancia para el envelope ADSR
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.02); // Attack
      gain1.gain.exponentialRampToValueAtTime(0.15, now + 0.1); // Decay
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5); // Release
      
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.1, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      const gain3 = ctx.createGain();
      gain3.gain.setValueAtTime(0, now + 0.05);
      gain3.gain.linearRampToValueAtTime(0.15, now + 0.08);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      // Conectar osciladores a ganancias
      osc1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(gain3);
      
      // Conectar ganancias al destino
      gain1.connect(ctx.destination);
      gain2.connect(ctx.destination);
      gain3.connect(ctx.destination);
      
      // Iniciar y detener osciladores
      osc1.start(now);
      osc2.start(now);
      osc3.start(now + 0.05);
      
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.7);
      osc3.stop(now + 0.5);
      
      // Limpiar después de que termine el sonido
      setTimeout(() => {
        isPlayingRef.current = false;
      }, 800);
      
    } catch (error) {
      console.warn("No se pudo reproducir el sonido de notificación:", error);
      isPlayingRef.current = false;
    }
  }, []);

  /**
   * Reproduce un sonido de alerta/advertencia
   */
  const playAlertSound = useCallback(() => {
    if (isPlayingRef.current) return;
    
    try {
      const ctx = getAudioContext();
      
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      isPlayingRef.current = true;
      const now = ctx.currentTime;
      
      // Dos tonos descendentes para alerta
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(600, now + 0.15);
      osc.frequency.setValueAtTime(800, now + 0.3);
      osc.frequency.setValueAtTime(600, now + 0.45);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.setValueAtTime(0.25, now + 0.13);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.17);
      gain.gain.setValueAtTime(0.25, now + 0.28);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.32);
      gain.gain.setValueAtTime(0.25, now + 0.43);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.47);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.7);
      
      setTimeout(() => {
        isPlayingRef.current = false;
      }, 800);
      
    } catch (error) {
      console.warn("No se pudo reproducir el sonido de alerta:", error);
      isPlayingRef.current = false;
    }
  }, []);

  /**
   * Reproduce un sonido de "carga completa" más elaborado
   * Secuencia de notas ascendentes que transmiten éxito
   */
  const playChargingCompleteSound = useCallback(() => {
    if (isPlayingRef.current) return;
    
    try {
      const ctx = getAudioContext();
      
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      isPlayingRef.current = true;
      const now = ctx.currentTime;
      
      // Secuencia de notas: C5 -> E5 -> G5 -> C6 (acorde de Do mayor ascendente)
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const noteDuration = 0.15;
      const noteGap = 0.12;
      
      notes.forEach((freq, index) => {
        const startTime = now + index * noteGap;
        
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        
        // Agregar un poco de vibrato al final
        if (index === notes.length - 1) {
          osc.frequency.setValueAtTime(freq, startTime + 0.1);
          osc.frequency.linearRampToValueAtTime(freq * 1.02, startTime + 0.2);
          osc.frequency.linearRampToValueAtTime(freq, startTime + 0.3);
        }
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        
        if (index === notes.length - 1) {
          // La última nota dura más
          gain.gain.setValueAtTime(0.25, startTime + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
        } else {
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
        }
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + (index === notes.length - 1 ? 0.9 : noteDuration + 0.1));
      });
      
      // Agregar un "shimmer" al final
      const shimmerOsc = ctx.createOscillator();
      shimmerOsc.type = "triangle";
      shimmerOsc.frequency.setValueAtTime(2093, now + 0.4); // C7
      
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0, now + 0.4);
      shimmerGain.gain.linearRampToValueAtTime(0.1, now + 0.45);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      
      shimmerOsc.connect(shimmerGain);
      shimmerGain.connect(ctx.destination);
      
      shimmerOsc.start(now + 0.4);
      shimmerOsc.stop(now + 1.1);
      
      setTimeout(() => {
        isPlayingRef.current = false;
      }, 1200);
      
    } catch (error) {
      console.warn("No se pudo reproducir el sonido de carga completa:", error);
      isPlayingRef.current = false;
    }
  }, []);

  return {
    playSuccessSound,
    playAlertSound,
    playChargingCompleteSound,
  };
}
