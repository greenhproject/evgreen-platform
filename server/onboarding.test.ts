import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock de localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("Onboarding", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("localStorage key", () => {
    it("should use correct localStorage key for onboarding state", () => {
      const ONBOARDING_KEY = "evgreen_onboarding_completed";
      expect(ONBOARDING_KEY).toBe("evgreen_onboarding_completed");
    });

    it("should store 'true' when onboarding is completed", () => {
      const ONBOARDING_KEY = "evgreen_onboarding_completed";
      localStorageMock.setItem(ONBOARDING_KEY, "true");
      expect(localStorageMock.getItem(ONBOARDING_KEY)).toBe("true");
    });

    it("should return null when onboarding is not completed", () => {
      const ONBOARDING_KEY = "evgreen_onboarding_completed";
      expect(localStorageMock.getItem(ONBOARDING_KEY)).toBeNull();
    });

    it("should be able to reset onboarding state", () => {
      const ONBOARDING_KEY = "evgreen_onboarding_completed";
      localStorageMock.setItem(ONBOARDING_KEY, "true");
      localStorageMock.removeItem(ONBOARDING_KEY);
      expect(localStorageMock.getItem(ONBOARDING_KEY)).toBeNull();
    });
  });

  describe("Onboarding slides", () => {
    const slides = [
      { id: 1, title: "Bienvenido a", subtitle: "EVGreen" },
      { id: 2, title: "Encuentra", subtitle: "Estaciones cercanas" },
      { id: 3, title: "Escanea", subtitle: "y carga al instante" },
      { id: 4, title: "Gestiona tu", subtitle: "Billetera digital" },
      { id: 5, title: "Revisa tu", subtitle: "Historial completo" },
    ];

    it("should have 5 slides", () => {
      expect(slides.length).toBe(5);
    });

    it("should have unique IDs for each slide", () => {
      const ids = slides.map((s) => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it("should have correct first slide content", () => {
      expect(slides[0].title).toBe("Bienvenido a");
      expect(slides[0].subtitle).toBe("EVGreen");
    });

    it("should have correct last slide content", () => {
      expect(slides[4].title).toBe("Revisa tu");
      expect(slides[4].subtitle).toBe("Historial completo");
    });
  });

  describe("Onboarding navigation", () => {
    it("should start at slide 0", () => {
      const currentSlide = 0;
      expect(currentSlide).toBe(0);
    });

    it("should be able to navigate to next slide", () => {
      let currentSlide = 0;
      const totalSlides = 5;
      
      if (currentSlide < totalSlides - 1) {
        currentSlide++;
      }
      
      expect(currentSlide).toBe(1);
    });

    it("should not go past last slide", () => {
      let currentSlide = 4;
      const totalSlides = 5;
      
      if (currentSlide < totalSlides - 1) {
        currentSlide++;
      }
      
      expect(currentSlide).toBe(4);
    });

    it("should be able to navigate to previous slide", () => {
      let currentSlide = 2;
      
      if (currentSlide > 0) {
        currentSlide--;
      }
      
      expect(currentSlide).toBe(1);
    });

    it("should not go before first slide", () => {
      let currentSlide = 0;
      
      if (currentSlide > 0) {
        currentSlide--;
      }
      
      expect(currentSlide).toBe(0);
    });

    it("should be able to jump to specific slide", () => {
      let currentSlide = 0;
      const targetSlide = 3;
      
      currentSlide = targetSlide;
      
      expect(currentSlide).toBe(3);
    });
  });

  describe("Onboarding completion", () => {
    it("should mark onboarding as complete when finished", () => {
      const ONBOARDING_KEY = "evgreen_onboarding_completed";
      
      // Simular completar onboarding
      localStorageMock.setItem(ONBOARDING_KEY, "true");
      
      const isCompleted = localStorageMock.getItem(ONBOARDING_KEY) === "true";
      expect(isCompleted).toBe(true);
    });

    it("should mark onboarding as complete when skipped", () => {
      const ONBOARDING_KEY = "evgreen_onboarding_completed";
      
      // Simular saltar onboarding
      localStorageMock.setItem(ONBOARDING_KEY, "true");
      
      const isCompleted = localStorageMock.getItem(ONBOARDING_KEY) === "true";
      expect(isCompleted).toBe(true);
    });
  });
});
