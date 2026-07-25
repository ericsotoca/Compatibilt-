import React, { useState, useEffect } from "react";
import { 
  Heart, 
  Copy, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Share2, 
  MessageSquare, 
  User, 
  Lock, 
  Volume2, 
  VolumeX, 
  Plus, 
  RefreshCw, 
  Sliders, 
  HelpCircle,
  AlertCircle,
  BookOpen,
  ShieldCheck,
  X
} from "lucide-react";
import { QUESTIONS, ENCOURAGING_MESSAGES, DEFAULT_PROFILE } from "./questions";
import { Question, Profile } from "./types";
import { 
  playClickSound, 
  playSuccessSound, 
  playCompletionSound, 
  playFailSound 
} from "./audio";

export default function App() {
  // App state
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [gameState, setGameState] = useState<"intro" | "playing" | "result" | "create">("intro");
  
  // Game states
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ [qId: number]: number }>({});
  const [failedAtQuestionIdx, setFailedAtQuestionIdx] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Password lock states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>(window.localStorage.getItem("admin_passed") === "true" ? "totototo" : "");
  const [passwordError, setPasswordError] = useState<string>("");

  // UI states
  const [copied, setCopied] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  
  // Creator states
  const [creatorName, setCreatorName] = useState<string>("");
  const [creatorMessenger, setCreatorMessenger] = useState<string>("");
  const [creatorSecretCode, setCreatorSecretCode] = useState<string>("");
  const [creatorCompat, setCreatorCompat] = useState<{ [qId: number]: number[] }>({});
  const [generatedLink, setGeneratedLink] = useState<string>("");

  // Sound toggle helper
  const handleSoundToggle = () => {
    setSoundEnabled(!soundEnabled);
  };

  const triggerSound = (type: "click" | "success" | "completion" | "fail") => {
    if (!soundEnabled) return;
    if (type === "click") playClickSound();
    if (type === "success") playSuccessSound();
    if (type === "completion") playCompletionSound();
    if (type === "fail") playFailSound();
  };

  // Safe base64 encoding/decoding for Unicode query param
  const encodeProfile = (p: Profile): string => {
    const str = JSON.stringify(p);
    const bytes = new TextEncoder().encode(str);
    const binString = String.fromCodePoint(...bytes);
    return btoa(binString);
  };

  const decodeProfile = (b64: string): Profile | null => {
    try {
      const binString = atob(b64);
      const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
      const str = new TextDecoder().decode(bytes);
      return JSON.parse(str);
    } catch (e) {
      console.error("Failed to decode profile from URL:", e);
      return null;
    }
  };

  // Check URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profileParam = params.get("p");
    if (profileParam) {
      const decoded = decodeProfile(profileParam);
      if (decoded) {
        setProfile({ ...decoded, isCustom: true });
      }
    }
  }, []);

  // Password Verification Prompt
  const openPasswordPrompt = () => {
    // If already verified previously in session/localstorage, we can prefill or directly open
    if (window.localStorage.getItem("admin_passed") === "true") {
      initCreator();
    } else {
      setIsPasswordModalOpen(true);
      setPasswordInput("");
      setPasswordError("");
      triggerSound("click");
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "totototo") {
      window.localStorage.setItem("admin_passed", "true");
      setIsPasswordModalOpen(false);
      initCreator();
    } else {
      setPasswordError("Mot de passe incorrect.");
      triggerSound("fail");
    }
  };

  // Initialize creator pre-fills
  const initCreator = () => {
    setCreatorName(profile.name === "Eric" ? "" : profile.name);
    setCreatorMessenger(profile.messengerUsername || "");
    setCreatorSecretCode(profile.secretCode || "AMOUR-" + Math.floor(1000 + Math.random() * 9000));
    
    // Pre-fill creator answers with current profile or defaults
    const initialCompat: { [qId: number]: number[] } = {};
    QUESTIONS.forEach((q) => {
      initialCompat[q.id] = profile.compatAnswers[q.id] || [...q.defaultCompat];
    });
    setCreatorCompat(initialCompat);
    setGeneratedLink("");
    setGameState("create");
    triggerSound("click");
  };

  // Start game handler
  const startChallenge = () => {
    setCurrentQuestionIdx(0);
    setSelectedAnswerIdx(null);
    setAnswers({});
    setFailedAtQuestionIdx(null);
    setGameState("playing");
    triggerSound("success");
  };

  // Answer selection
  const handleSelectAnswer = (ansIdx: number) => {
    setSelectedAnswerIdx(ansIdx);
    triggerSound("click");
  };

  // Submission handler
  const handleNextQuestion = () => {
    if (selectedAnswerIdx === null) return;

    const currentQuestion = QUESTIONS[currentQuestionIdx];
    const updatedAnswers = { ...answers, [currentQuestion.id]: selectedAnswerIdx };
    setAnswers(updatedAnswers);

    // Evaluate compatibility for the current question
    const compatibleIndices = profile.compatAnswers[currentQuestion.id] || currentQuestion.defaultCompat;
    const isCompatible = compatibleIndices.includes(selectedAnswerIdx);

    let nextFailedIdx = failedAtQuestionIdx;
    if (!isCompatible && failedAtQuestionIdx === null) {
      nextFailedIdx = currentQuestionIdx;
      setFailedAtQuestionIdx(currentQuestionIdx);
    }

    // Delay rule logic check:
    // If we have already failed, we allow exactly ONE more question to be answered before ending the game.
    // So if failedAtQuestionIdx is not null, and the current question we just answered is (failedAtQuestionIdx + 1),
    // we must terminate the game right now.
    const shouldTerminateNow = nextFailedIdx !== null && currentQuestionIdx === nextFailedIdx + 1;

    if (shouldTerminateNow) {
      // End game instantly with failure state
      setGameState("result");
      triggerSound("fail");
    } else if (currentQuestionIdx < QUESTIONS.length - 1) {
      // Proceed to next question
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setSelectedAnswerIdx(null);
    } else {
      // We reached the final question.
      // If we finished and have any failure recorded, show failure. Otherwise, success!
      setGameState("result");
      if (nextFailedIdx !== null) {
        triggerSound("fail");
      } else {
        triggerSound("completion");
      }
    }
  };

  // Copy secret code to clipboard
  const copySecretCode = () => {
    const textToCopy = `J'ai réussi ton Défi Compatibilité ! J'ai obtenu le code secret : ${profile.secretCode}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    triggerSound("click");
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate custom link
  const generateCreatorLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim()) return;

    // Validate that every question has at least one compatible option checked
    const missingSelections = QUESTIONS.some((q) => !creatorCompat[q.id] || creatorCompat[q.id].length === 0);
    if (missingSelections) {
      alert("Veuillez sélectionner au moins une réponse compatible pour chaque question !");
      return;
    }

    const customProfile: Profile = {
      name: creatorName.trim(),
      compatAnswers: creatorCompat,
      secretCode: creatorSecretCode.trim() || "SECRET-99",
      messengerUsername: creatorMessenger.trim() || undefined,
      isCustom: true
    };

    const encoded = encodeProfile(customProfile);
    const link = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
    setGeneratedLink(link);
    triggerSound("completion");
  };

  // Toggle creator answers compatibility selection
  const toggleCreatorOption = (qId: number, optionIdx: number) => {
    const current = creatorCompat[qId] || [];
    let updated: number[];
    if (current.includes(optionIdx)) {
      // Don't allow empty selections
      if (current.length === 1) return;
      updated = current.filter((idx) => idx !== optionIdx);
    } else {
      updated = [...current, optionIdx].sort();
    }
    setCreatorCompat({ ...creatorCompat, [qId]: updated });
    triggerSound("click");
  };

  // Copy shareable link
  const copyShareLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setShareCopied(true);
    triggerSound("click");
    setTimeout(() => setShareCopied(false), 2000);
  };

  // Determine if general game success
  const isSuccessfulGame = failedAtQuestionIdx === null && Object.keys(answers).length === QUESTIONS.length;

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 bg-[#faf8f6] relative">
      {/* Dynamic Background Graphics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-rose-100 blur-3xl"></div>
        <div className="absolute bottom-[10%] right-[5%] w-80 h-80 rounded-full bg-orange-50 blur-3xl"></div>
      </div>

      {/* Floating sound and mode toggles */}
      <header className="relative z-10 w-full max-w-2xl mx-auto flex justify-between items-center mb-6">
        <button
          onClick={() => {
            setGameState("intro");
            setProfile(DEFAULT_PROFILE);
            // clear query params smoothly
            window.history.pushState({}, "", window.location.pathname);
            triggerSound("click");
          }}
          className="flex items-center gap-2 group text-sm font-medium text-[#c85a53] hover:text-[#b04a43] transition-colors bg-transparent border-none cursor-pointer"
          id="btn-logo-home"
        >
          <div className="p-2 rounded-full bg-rose-50 group-hover:scale-105 transition-transform">
            <Heart className="w-5 h-5 fill-rose-300 stroke-[#c85a53]" />
          </div>
          <span className="font-serif text-lg tracking-tight font-semibold">Le Défi Compatibilité</span>
        </button>

        <div className="flex gap-2">
          {/* Sound Toggle */}
          <button
            onClick={handleSoundToggle}
            className="p-2 rounded-full bg-white border border-[#eae1dc] text-[#5c4d4a] hover:bg-rose-50 hover:text-[#c85a53] transition-all cursor-pointer"
            title={soundEnabled ? "Couper le son" : "Activer le son"}
            id="btn-toggle-sound"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-grow flex items-center justify-center w-full max-w-xl mx-auto">
        
        {/* INTRO SCREEN */}
        {gameState === "intro" && (
          <div className="w-full bg-white border border-[#eae1dc] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col items-center text-center space-y-6 animate-fade-in" id="panel-intro">
            <div className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-[#c85a53] rounded-full text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rencontre Amoureuse Gamifiée</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-serif font-extrabold tracking-tight text-[#2c2321]">
                Es-tu compatible avec <span className="text-[#c85a53] underline decoration-rose-200 underline-offset-4">{profile.name}</span> ?
              </h1>
              <p className="text-sm md:text-base text-[#6b5854] max-w-md mx-auto leading-relaxed">
                Ce défi comporte <span className="font-bold text-[#c85a53]">{QUESTIONS.length} questions</span> de plus en plus personnelles. Si tu partages 100% de ses critères de vie, tu obtiendras son <span className="font-semibold text-[#c85a53]">code secret de compatibilité</span> !
              </p>
            </div>

            {/* Buttons */}
            <div className="w-full pt-2 flex flex-col gap-3">
              <button
                onClick={startChallenge}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-[#c85a53] hover:bg-[#b04a43] active:scale-[0.98] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group text-base cursor-pointer"
                id="btn-start-challenge"
              >
                <span>Lancer le Défi</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={openPasswordPrompt}
                className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-[#5c4d4a] hover:text-[#c85a53] hover:bg-rose-50/50 border border-[#eae1dc] transition-all flex items-center justify-center gap-2 cursor-pointer"
                id="btn-goto-creator"
              >
                <Lock className="w-4 h-4" />
                <span>Gérer le défi</span>
              </button>
            </div>

            {profile.isCustom && (
              <p className="text-xs text-[#9c847f] italic">
                Ce défi a été conçu sur mesure par {profile.name}.
              </p>
            )}
          </div>
        )}

        {/* ACTIVE GAMEPLAY SCREEN */}
        {gameState === "playing" && (() => {
          const sincerityScore = currentQuestionIdx * 120;
          const multiplier = 1 + Math.floor(currentQuestionIdx / 5);
          
          const getGamifiedBadge = (qIdx: number) => {
            if (qIdx < 5) return { title: "Prétendant Novice 🌸", color: "text-rose-700 bg-rose-50 border-rose-100" };
            if (qIdx < 10) return { title: "Explorateur Sincère 🗺️", color: "text-amber-700 bg-amber-50 border-amber-100" };
            if (qIdx < 15) return { title: "Compagnon Complice 🧩", color: "text-emerald-700 bg-emerald-50 border-emerald-100" };
            if (qIdx < 20) return { title: "Maître de l'Harmonie 🔮", color: "text-indigo-700 bg-indigo-50 border-indigo-100" };
            if (qIdx < 25) return { title: "Esprit Supérieur ✨", color: "text-purple-700 bg-purple-50 border-purple-100" };
            return { title: "Destinée Absolue 💖", color: "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" };
          };

          const currentBadge = getGamifiedBadge(currentQuestionIdx);

          // Calculer l'avancement avec un décalage de 2 questions pour préserver le mystère des réponses correctes.
          // Ainsi, l'avancement visible ne bouge que pour les réponses données il y a au moins 2 questions.
          const maxEvaluatedIdx = Math.max(0, currentQuestionIdx - 2);
          const evaluatedQuestions = QUESTIONS.slice(0, maxEvaluatedIdx);
          const delayedCompatibleCount = evaluatedQuestions.reduce((acc, q) => {
            const ans = answers[q.id];
            if (ans === undefined) return acc;
            const compatibleIndices = profile.compatAnswers[q.id] || q.defaultCompat;
            return acc + (compatibleIndices.includes(ans) ? 1 : 0);
          }, 0);
          const compatRatio = QUESTIONS.length > 0 ? delayedCompatibleCount / QUESTIONS.length : 0;

          return (
            <div className="w-full bg-white border border-[#eae1dc] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6 animate-fade-in" id="panel-gameplay">
              {/* Upper levels tracker */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-[#9c847f]">
                  <span className="uppercase tracking-wider">Question {currentQuestionIdx + 1} sur {QUESTIONS.length}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f4ebe6] text-[#c85a53] text-[10px] uppercase tracking-wide">
                    {QUESTIONS[currentQuestionIdx].level}
                  </span>
                </div>
                
                {/* Elegant Progress bar */}
                <div className="w-full h-2.5 bg-[#f4ebe6] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-400 to-[#c85a53] transition-all duration-500 ease-out"
                    style={{ width: `${((currentQuestionIdx + 1) / QUESTIONS.length) * 100}%` }}
                  />
                </div>

                {/* Gamification Dashboard */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-[#fcfbf9] border border-[#f0eae6] rounded-xl p-2 flex flex-col justify-center items-center shadow-xs">
                    <span className="text-[9px] font-bold text-[#9c847f] uppercase tracking-wider">Score Sincérité</span>
                    <span className="text-xs font-black text-[#c85a53] flex items-center gap-0.5 mt-0.5">
                      {sincerityScore} <span className="text-[9px] font-normal text-[#9c847f]">PTS</span>
                    </span>
                  </div>
                  <div className="bg-[#fcfbf9] border border-[#f0eae6] rounded-xl p-2 flex flex-col justify-center items-center shadow-xs">
                    <span className="text-[9px] font-bold text-[#9c847f] uppercase tracking-wider">Multiplicateur</span>
                    <span className="text-xs font-black text-amber-600 flex items-center gap-0.5 mt-0.5">
                      x{multiplier} 🔥
                    </span>
                  </div>
                  <div className="bg-[#fcfbf9] border border-[#f0eae6] rounded-xl p-2 flex flex-col justify-center items-center shadow-xs">
                    <span className="text-[9px] font-bold text-[#9c847f] uppercase tracking-wider">Titre Actuel</span>
                    <span className="text-[10px] font-bold text-rose-700 truncate max-w-full mt-0.5">
                      {currentBadge.title}
                    </span>
                  </div>
                </div>

                {/* Interactive Emoji Proximity Path */}
                <div className="bg-rose-50/20 border border-rose-100/60 rounded-xl p-3 flex flex-col space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                    <span>Proximité Amoureuse</span>
                    <span>{Math.round(compatRatio * 100)}% d'affinité</span>
                  </div>
                  
                  <div className="h-8 bg-[#fdfaf8] rounded-lg relative border border-[#eae1dc]/40 flex items-center px-6">
                    {/* Dotted connection track */}
                    <div className="absolute left-6 right-6 h-0.5 border-t border-dashed border-rose-200" />
                    
                    {compatRatio < 1 ? (
                      <>
                        {/* Woman 👩 on left moving to the center */}
                        <div 
                          className="absolute text-xl transition-all duration-700 ease-out select-none"
                          style={{ 
                            left: `calc(1.5rem + ${compatRatio * 38}%)`,
                            transform: 'translateX(-50%)' 
                          }}
                        >
                          👩
                        </div>
                        
                        {/* Heart in the middle growing as they approach */}
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 text-xs transition-all duration-300"
                          style={{
                            transform: `translate(-50%) scale(${0.4 + compatRatio * 0.8})`,
                            opacity: compatRatio > 0.05 ? 0.9 : 0.2
                          }}
                        >
                          ❤️
                        </div>

                        {/* Man 👨 on right moving to the center */}
                        <div 
                          className="absolute text-xl transition-all duration-700 ease-out select-none"
                          style={{ 
                            right: `calc(1.5rem + ${compatRatio * 38}%)`,
                            transform: 'translateX(50%)' 
                          }}
                        >
                          👨
                        </div>
                      </>
                    ) : (
                      /* Fully compatible union in center */
                      <div className="absolute left-1/2 -translate-x-1/2 text-2xl animate-bounce flex items-center gap-1 select-none">
                        <span>👩‍❤️‍👨</span>
                        <span className="text-xs absolute -top-1 -right-3 animate-ping">💖</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Question Header */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c85a53]">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Thématique : {QUESTIONS[currentQuestionIdx].title}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-serif font-bold text-[#2c2321] leading-tight">
                  {QUESTIONS[currentQuestionIdx].question}
                </h2>
              </div>

              {/* Answer buttons stack */}
              <div className="space-y-3" id="answers-stack">
                {QUESTIONS[currentQuestionIdx].answers.map((answer, index) => {
                  const isSelected = selectedAnswerIdx === index;
                  const letterLabel = String.fromCharCode(65 + index);
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectAnswer(index)}
                      className={`w-full p-4 rounded-xl text-left border transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected 
                          ? "border-[#c85a53] bg-rose-50/40 text-[#2c2321] ring-1 ring-[#c85a53]" 
                          : "border-[#eae1dc] bg-white hover:bg-rose-50/10 text-[#5c4d4a] hover:border-[#c85a53]/40"
                      }`}
                      id={`answer-opt-${letterLabel.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Letter bubble */}
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border transition-colors ${
                          isSelected 
                            ? "bg-[#c85a53] text-white border-[#c85a53]" 
                            : "bg-[#fcfbf9] text-[#9c847f] border-[#eae1dc] group-hover:border-[#c85a53]/40"
                        }`}>
                          {letterLabel}
                        </span>
                        <span className="text-sm font-medium pr-2 leading-snug">{answer}</span>
                      </div>
                      
                      {/* Tick box visual feedback */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected 
                          ? "bg-[#c85a53] border-[#c85a53]" 
                          : "border-[#eae1dc] group-hover:border-[#c85a53]/40"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Next Step Control */}
              <div className="pt-2 flex flex-col space-y-4">
                <button
                  disabled={selectedAnswerIdx === null}
                  onClick={handleNextQuestion}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    selectedAnswerIdx !== null
                      ? "bg-[#c85a53] text-white hover:bg-[#b04a43] shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
                      : "bg-[#f0eae6] text-[#9c847f] cursor-not-allowed"
                  }`}
                  id="btn-next-question"
                >
                  <span>
                    {currentQuestionIdx === QUESTIONS.length - 1 ? "Soumettre mes réponses" : "Confirmer et Continuer"}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Encouraging helper subtitle */}
                <div className="text-center">
                  <p className="text-xs text-[#9c847f] italic transition-opacity duration-300">
                    {currentQuestionIdx > 0 
                      ? ENCOURAGING_MESSAGES[Math.min(currentQuestionIdx - 1, ENCOURAGING_MESSAGES.length - 1)]
                      : "Répondez avec sincérité pour tester la compatibilité réelle."}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* RESULTS SCREEN */}
        {gameState === "result" && (
          <div className="w-full bg-white border border-[#eae1dc] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col items-center text-center space-y-6" id="panel-results">
            {isSuccessfulGame ? (
              /* SUCCESS CASE */
              <>
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-[#c85a53]">
                    <Heart className="w-10 h-10 fill-[#c85a53] animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-1 rounded-full">
                    <Sparkles className="w-4 h-4 fill-amber-300" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#2c2321]">
                    Compatibilité 100% !
                  </h2>
                  <p className="text-sm md:text-base text-[#6b5854] max-w-md leading-relaxed">
                    Félicitations ! Vos choix de vie correspondent parfaitement à l'ensemble des attentes de <span className="font-semibold text-[#c85a53]">{profile.name}</span>.
                  </p>
                </div>

                {/* Secret Code Widget */}
                <div className="w-full bg-[#fdfaf8] border border-rose-100 rounded-xl p-5 space-y-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#9c847f]">Votre Code Secret Débloqué</span>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl font-mono font-black tracking-widest text-[#c85a53] bg-rose-50 px-4 py-1.5 rounded-lg border border-rose-100">
                        {profile.secretCode}
                      </span>
                      <button
                        onClick={copySecretCode}
                        className="p-2.5 rounded-lg bg-white border border-[#eae1dc] text-[#5c4d4a] hover:bg-rose-50 hover:text-[#c85a53] transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        title="Copier le code secret"
                        id="btn-copy-code"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? "Copié !" : "Copier"}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#6b5854] leading-relaxed max-w-sm mx-auto">
                    Envoyez ce code par Messenger pour révéler votre identité et lancer la discussion :
                    <br />
                    <span className="italic font-medium text-[#2c2321] block mt-1.5">
                      "J'ai réussi le défi, j'ai obtenu le code secret."
                    </span>
                  </p>
                </div>

                {/* Messenger redirect buttons */}
                <div className="w-full pt-2 flex flex-col gap-3">
                  {profile.messengerUsername ? (() => {
                    const isFullUrl = profile.messengerUsername.startsWith("http");
                    const href = isFullUrl 
                      ? profile.messengerUsername 
                      : (profile.messengerUsername === "eric.sotoca"
                        ? "https://www.facebook.com/eric.sotoca"
                        : `https://m.me/${profile.messengerUsername}`);
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-[#0084FF] hover:bg-[#0072dd] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-center decoration-none"
                        onClick={() => {
                          triggerSound("click");
                          // Also automatically copy to help the user
                          const msg = `J'ai réussi le défi, j'ai obtenu le code secret : ${profile.secretCode}`;
                          navigator.clipboard.writeText(msg);
                        }}
                        id="btn-messenger-direct"
                      >
                        <MessageSquare className="w-5 h-5 fill-white" />
                        <span>Contacter {profile.name} sur Facebook</span>
                      </a>
                    );
                  })() : (
                    <button
                      onClick={copySecretCode}
                      className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-[#c85a53] hover:bg-[#b04a43] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      id="btn-generic-contact"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Copier le message de contact</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setGameState("intro");
                      triggerSound("click");
                    }}
                    className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-[#5c4d4a] hover:bg-rose-50/50 border border-[#eae1dc] transition-all cursor-pointer"
                    id="btn-restart-game"
                  >
                    Recommencer le défi
                  </button>
                </div>
              </>
            ) : (
              /* FAILURE CASE - RETRY REMOVED, IP LOG INFORMATION ADDED */
              <>
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-[#c85a53]">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <div className="space-y-4">
                  <h2 className="text-2xl font-serif font-bold text-[#2c2321]">
                    Parcours terminé
                  </h2>
                  <p className="text-sm text-[#6b5854] max-w-sm mx-auto leading-relaxed">
                    Merci d'avoir participé au défi. Le parcours est terminé.
                  </p>

                  {/* Elegant locked status message */}
                  <div className="w-full bg-[#fff5f5] border border-rose-100 rounded-xl p-4 space-y-2 text-left">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                      <Lock className="w-4 h-4 text-[#c85a53]" />
                      <span>Tentative unique épuisée</span>
                    </div>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      Il est strictement impossible de recommencer ce test de compatibilité pour fausser ou forcer les résultats.
                      Votre adresse IP <span className="font-semibold underline">a été enregistrée</span> et rattachée à cette tentative afin de garantir la sincérité et l'authenticité absolue de la démarche.
                    </p>
                  </div>
                  
                  <p className="text-[11px] text-[#9c847f] italic max-w-xs mx-auto leading-normal">
                    Conformément aux règles de discrétion, aucun détail sur les critères de tri ou l'élément divergent n'est communiqué.
                  </p>
                </div>

                {/* Failure CTAs - No "Réessayer" button, only 'Gérer le défi' option */}
                <div className="w-full pt-4 flex flex-col gap-3">
                  <button
                    onClick={openPasswordPrompt}
                    className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-[#5c4d4a] hover:text-[#c85a53] hover:bg-rose-50/50 border border-[#eae1dc] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    id="btn-failure-goto-creator"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Gérer le défi</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* CREATOR SCREEN */}
        {gameState === "create" && (
          <div className="w-full bg-white border border-[#eae1dc] rounded-2xl p-6 shadow-sm flex flex-col space-y-6" id="panel-creator">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-serif font-bold text-[#2c2321]">
                Configuration du Défi Compatibilité
              </h2>
              <p className="text-xs text-[#6b5854]">
                Définissez vos propres critères pour tester vos prétendants.
              </p>
            </div>

            <form onSubmit={generateCreatorLink} className="space-y-6">
              
              {/* Profile identity info */}
              <div className="space-y-4 bg-[#fcfbf9] border border-[#f0eae6] rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#9c847f] flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>1. Votre Profil & Contact</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#5c4d4a] block">
                      Votre Prénom / Pseudo *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Éric"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      className="w-full p-2.5 text-sm rounded-lg border border-[#eae1dc] bg-white focus:outline-none focus:border-[#c85a53]"
                      id="input-creator-name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#5c4d4a] block flex items-center gap-1">
                      <span>Pseudo Messenger (Optionnel)</span>
                      <div className="group relative cursor-help">
                        <HelpCircle className="w-3.5 h-3.5 text-[#9c847f]" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded bg-gray-800 text-[10px] text-white leading-normal font-normal opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          Votre nom d'utilisateur Facebook (ex: "eric.sotoca") pour que les gagnants puissent vous envoyer un message directement.
                        </span>
                      </div>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: eric.sotoca"
                      value={creatorMessenger}
                      onChange={(e) => setCreatorMessenger(e.target.value)}
                      className="w-full p-2.5 text-sm rounded-lg border border-[#eae1dc] bg-white focus:outline-none focus:border-[#c85a53]"
                      id="input-creator-messenger"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#5c4d4a] block">
                    Code Secret Personnalisé
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: EROS-2026"
                      value={creatorSecretCode}
                      onChange={(e) => setCreatorSecretCode(e.target.value.toUpperCase())}
                      className="w-full p-2.5 text-sm font-mono rounded-lg border border-[#eae1dc] bg-white focus:outline-none focus:border-[#c85a53]"
                      id="input-creator-secret"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCreatorSecretCode("AMOUR-" + Math.floor(1000 + Math.random() * 9000));
                        triggerSound("click");
                      }}
                      className="px-3 rounded-lg border border-[#eae1dc] bg-white text-[#5c4d4a] hover:bg-rose-50 text-xs font-medium cursor-pointer"
                    >
                      Aléatoire
                    </button>
                  </div>
                </div>
              </div>

              {/* Questions criteria selector */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#9c847f] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>2. Réponses Compatibles (Sélectionnez une ou plusieurs options par question)</span>
                </h3>
                
                <p className="text-[11px] text-[#9c847f] italic leading-snug">
                  Cochez les réponses que vous considérez comme compatibles. Tout prétendant choisissant une réponse non cochée sera incompatible !
                </p>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 border-t border-b border-[#f0eae6] py-3">
                  {QUESTIONS.map((q) => {
                    const selected = creatorCompat[q.id] || [];
                    return (
                      <div key={q.id} className="p-3.5 rounded-lg border border-[#f0eae6] bg-[#fcfbf9] space-y-3 text-left">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-extrabold text-[#c85a53]">Q{q.id}. {q.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-semibold uppercase">{q.importance}</span>
                        </div>
                        <p className="text-xs font-semibold text-[#2c2321]">{q.question}</p>
                        
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {q.answers.map((answer, idx) => {
                            const isChecked = selected.includes(idx);
                            const letter = String.fromCharCode(65 + idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleCreatorOption(q.id, idx)}
                                className={`p-2 rounded text-left text-xs flex items-center justify-between border transition-all cursor-pointer ${
                                  isChecked 
                                    ? "bg-rose-50/50 border-[#c85a53] text-[#2c2321]" 
                                    : "bg-white border-[#eae1dc] text-[#6b5854] hover:bg-gray-50"
                                }`}
                              >
                                <span className="font-medium pr-1">{letter} : {answer}</span>
                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                  isChecked ? "bg-[#c85a53] border-[#c85a53]" : "border-[#eae1dc]"
                                }`}>
                                  {isChecked && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-3 px-6 rounded-xl font-bold text-white bg-[#c85a53] hover:bg-[#b04a43] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  id="btn-submit-creator"
                >
                  <Sparkles className="w-5 h-5 fill-white" />
                  <span>Générer mon Défi Compatibilité</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setGameState("intro");
                    triggerSound("click");
                  }}
                  className="w-full py-2.5 px-6 rounded-xl font-semibold text-xs text-[#5c4d4a] hover:bg-rose-50/50 border border-[#eae1dc] transition-all cursor-pointer"
                >
                  Retour à l'accueil
                </button>
              </div>
            </form>

            {/* Generated Link Result Widget */}
            {generatedLink && (
              <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center space-y-4" id="creator-link-result">
                <div className="flex justify-center text-emerald-600">
                  <Check className="w-8 h-8 rounded-full bg-emerald-100 p-1.5 stroke-[3px]" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">Défi généré avec succès !</h4>
                  <p className="text-xs text-emerald-700 leading-normal">
                    Copiez le lien ci-dessous et partagez-le sur Facebook, Messenger, ou WhatsApp. Vos amis pourront tester leur compatibilité avec vous !
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type="text"
                    value={generatedLink}
                    className="w-full p-2 text-xs bg-white rounded border border-emerald-200 focus:outline-none font-mono truncate"
                  />
                  <button
                    onClick={copyShareLink}
                    className="p-2 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded transition-all text-xs font-bold whitespace-nowrap flex items-center gap-1 cursor-pointer"
                    id="btn-copy-share"
                  >
                    {shareCopied ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
                    <span>{shareCopied ? "Copié !" : "Copier"}</span>
                  </button>
                </div>

                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      // Apply generated profile immediately to test-drive!
                      const decoded = decodeProfile(generatedLink.split("?p=")[1]);
                      if (decoded) {
                        setProfile({ ...decoded, isCustom: true });
                        setGameState("intro");
                        triggerSound("success");
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#c85a53] text-white hover:bg-[#b04a43] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tester mon propre défi</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER & LOGOUT IF GÉRANT */}
      <footer className="relative z-10 w-full max-w-2xl mx-auto mt-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-[11px] text-[#9c847f]">
          <span>© 2026 Le Défi Compatibilité</span>
          <span>•</span>
          <span>Mode anonyme sécurisé (IP logs activés)</span>
          <span>•</span>
          <button 
            onClick={() => {
              setProfile(DEFAULT_PROFILE);
              setGameState("intro");
              window.history.pushState({}, "", window.location.pathname);
              triggerSound("click");
            }}
            className="hover:underline text-[#c85a53] font-medium bg-transparent border-none cursor-pointer"
          >
            Défi initial d'Eric
          </button>
          {window.localStorage.getItem("admin_passed") === "true" && (
            <>
              <span>•</span>
              <button
                onClick={() => {
                  window.localStorage.removeItem("admin_passed");
                  setGameState("intro");
                  triggerSound("click");
                }}
                className="hover:underline text-gray-500 font-medium bg-transparent border-none cursor-pointer"
              >
                Déconnexion Gérant
              </button>
            </>
          )}
        </div>
      </footer>

      {/* PASSWORD PROTECTION MODAL DIALOG */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-[#2c2321]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#eae1dc] p-6 shadow-xl relative animate-fade-in text-center space-y-5">
            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-[#c85a53] mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-serif font-bold text-[#2c2321]">Zone Gérant Requis</h3>
              <p className="text-xs text-[#6b5854]">
                Entrez le mot de passe administrateur pour accéder à l'interface de gestion et de création de défi.
              </p>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-[#5c4d4a] uppercase tracking-wide">Mot de passe</label>
                <input
                  type="password"
                  required
                  placeholder="Saisir le mot de passe..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#eae1dc] focus:outline-none focus:border-[#c85a53] text-sm text-center tracking-widest font-mono"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1 justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/2 py-2.5 text-xs font-semibold text-[#5c4d4a] border border-[#eae1dc] rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 text-xs font-bold text-white bg-[#c85a53] hover:bg-[#b04a43] rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
