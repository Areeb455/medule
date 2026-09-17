import { useState, useEffect, useRef } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", flag: "🇿🇦" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", name: "Chinese (Simp)", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
];

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

export default function LanguageTranslator() {
  const [currentLang, setCurrentLang] = useState<string>("en");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Google Translate Script
  useEffect(() => {
    // Read saved language or cookie
    const saved = localStorage.getItem("medule_lang") || "en";
    setCurrentLang(saved);

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: LANGUAGES.map((l) => l.code).join(","),
            autoDisplay: false,
          },
          "google_translate_element"
        );
      }
    };

    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode);
    localStorage.setItem("medule_lang", langCode);
    setIsOpen(false);

    // Set cookie for Google Translate
    const cookieVal = `/en/${langCode}`;
    document.cookie = `googtrans=${cookieVal}; path=/;`;
    document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname};`;

    // Trigger select element in Google Translate widget if available
    const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Reload page if combo not found to apply cookie
      window.location.reload();
    }
  };

  const toggleHindi = () => {
    if (currentLang === "hi") {
      changeLanguage("en");
    } else {
      changeLanguage("hi");
    }
  };

  const activeLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className="flex items-center gap-2 notranslate" ref={dropdownRef}>
      {/* Hidden container for Google Translate Widget */}
      <div id="google_translate_element" style={{ display: "none" }} />

      {/* Quick Hindi Toggle Button */}
      <button
        type="button"
        onClick={toggleHindi}
        title={currentLang === "hi" ? "Switch back to English" : "Switch to Hindi"}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 border ${
          currentLang === "hi"
            ? "gradient-bg text-primary-foreground border-transparent shadow-md scale-105"
            : "bg-secondary/50 text-foreground hover:bg-secondary border-border/60 hover:border-primary/40"
        }`}
      >
        <span className="text-sm">🇮🇳</span>
        <span>{currentLang === "hi" ? "English" : "हिन्दी"}</span>
      </button>

      {/* Multi-Language Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 bg-secondary/50 hover:bg-secondary text-foreground border border-border/60 hover:border-primary/40 transition-colors"
        >
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">{activeLangObj.flag} {activeLangObj.name}</span>
          <span className="sm:hidden">{activeLangObj.flag}</span>
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto glass card-shadow rounded-2xl p-1.5 z-50 border border-border/80 backdrop-blur-xl animate-fade-in-up">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
              Select Language / भाषा चुनें
            </div>
            <div className="space-y-0.5">
              {LANGUAGES.map((lang) => {
                const isSelected = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                      isSelected
                        ? "gradient-bg text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                      {lang.nativeName !== lang.name && (
                        <span className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          ({lang.name})
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
